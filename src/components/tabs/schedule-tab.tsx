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

export function ScheduleTab({
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
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order("week")
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
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-muted" />
        ))}
      </div>
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
            <TableHead className="text-muted-foreground">Result</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((g) => {
            const isHome = g.home_team_id === teamId;
            const opponentId = isHome ? g.away_team_id : g.home_team_id;
            const opponent = teamsById.get(opponentId)?.name ?? "Unknown";
            const teamScore = isHome ? g.home_score : g.away_score;
            const oppScore = isHome ? g.away_score : g.home_score;
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
                  {g.status === "Final" ? `${teamScore} - ${oppScore}` : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      g.status === "Final"
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }
                  >
                    {g.status}
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
