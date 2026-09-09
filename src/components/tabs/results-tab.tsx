"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Game, Team } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ResultsTab({
  teamId,
  season,
  teamsById,
}: {
  teamId: string;
  season: number;
  teamsById: Map<string, Team>;
}) {
  const [games, setGames] = useState<Game[] | null>(null);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    supabase
      .from("games")
      .select("*")
      .eq("season", season)
      .eq("status", "Final")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order("week", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setGames((data as Game[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, season]);

  if (!games) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-muted" />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No completed games yet for this team in the {season} season.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Week</TableHead>
            <TableHead className="text-muted-foreground">Date</TableHead>
            <TableHead className="text-muted-foreground">Matchup</TableHead>
            <TableHead className="text-muted-foreground">Score</TableHead>
            <TableHead className="text-muted-foreground">W/L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((g) => {
            const isHome = g.home_team_id === teamId;
            const opponentId = isHome ? g.away_team_id : g.home_team_id;
            const opponent = teamsById.get(opponentId)?.name ?? "Unknown";
            const teamScore = (isHome ? g.home_score : g.away_score) ?? 0;
            const oppScore = (isHome ? g.away_score : g.home_score) ?? 0;
            const outcome = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "T";
            return (
              <TableRow key={g.id} className="border-border">
                <TableCell className="text-foreground">{g.week}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(g.game_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-foreground">
                  {isHome ? "vs" : "@"} <span className="team-name">{opponent}</span>
                </TableCell>
                <TableCell className="text-foreground">
                  {teamScore} - {oppScore}
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      outcome === "W"
                        ? "bg-primary/20 text-primary"
                        : outcome === "L"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-secondary text-secondary-foreground"
                    }
                  >
                    {outcome}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
