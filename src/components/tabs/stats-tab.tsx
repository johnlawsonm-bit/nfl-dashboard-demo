"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Player, PlayerStats, TeamStats } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PlayerStatRow = PlayerStats & { name: string; position: string };

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="team-name text-xl">{value}</p>
    </div>
  );
}

export function StatsTab({ teamId, season }: { teamId: string; season: number }) {
  const [teamStats, setTeamStats] = useState<TeamStats | null | undefined>(undefined);
  const [playerStats, setPlayerStats] = useState<PlayerStatRow[] | null>(null);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    supabase
      .from("team_stats")
      .select("*")
      .eq("team_id", teamId)
      .eq("season", season)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setTeamStats((data as TeamStats) ?? null);
      });

    (async () => {
      const { data: players } = await supabase
        .from("players")
        .select("id, name, position")
        .eq("team_id", teamId);
      const playerRows = (players as Pick<Player, "id" | "name" | "position">[]) ?? [];
      if (playerRows.length === 0) {
        if (!cancelled) setPlayerStats([]);
        return;
      }
      const ids = playerRows.map((p) => p.id);
      const { data: stats } = await supabase
        .from("player_stats")
        .select("*")
        .in("player_id", ids)
        .eq("season", season);
      const statsById = new Map((stats as PlayerStats[]).map((s) => [s.player_id, s]));
      const merged: PlayerStatRow[] = playerRows
        .map((p) => {
          const s = statsById.get(p.id);
          if (!s) return null;
          return { ...s, name: p.name, position: p.position };
        })
        .filter((r): r is PlayerStatRow => r !== null)
        .sort((a, b) => {
          const totalA = a.pass_yards + a.rush_yards + a.rec_yards;
          const totalB = b.pass_yards + b.rush_yards + b.rec_yards;
          return totalB - totalA;
        });
      if (!cancelled) setPlayerStats(merged);
    })();

    return () => {
      cancelled = true;
    };
  }, [teamId, season]);

  return (
    <div className="space-y-8">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="team-name">Team Stats — {season}</CardTitle>
        </CardHeader>
        <CardContent>
          {teamStats === undefined ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-muted" />
              ))}
            </div>
          ) : teamStats === null ? (
            <p className="text-sm text-muted-foreground">No team stats available for {season}.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Record" value={`${teamStats.wins}-${teamStats.losses}-${teamStats.ties}`} />
              <StatTile label="Points For" value={teamStats.points_for} />
              <StatTile label="Points Against" value={teamStats.points_against} />
              <StatTile label="Total Yards" value={teamStats.total_yards} />
              <StatTile label="Passing Yards" value={teamStats.passing_yards} />
              <StatTile label="Rushing Yards" value={teamStats.rushing_yards} />
              <StatTile label="Turnovers" value={teamStats.turnovers} />
              <StatTile label="Sacks" value={teamStats.sacks} />
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="team-name mb-3 text-lg">Individual Stats — {season}</h3>
        {!playerStats ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-muted" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Player</TableHead>
                  <TableHead className="text-muted-foreground">Pos</TableHead>
                  <TableHead className="text-muted-foreground">GP</TableHead>
                  <TableHead className="text-muted-foreground">Pass Yds</TableHead>
                  <TableHead className="text-muted-foreground">Pass TD</TableHead>
                  <TableHead className="text-muted-foreground">Rush Yds</TableHead>
                  <TableHead className="text-muted-foreground">Rush TD</TableHead>
                  <TableHead className="text-muted-foreground">Rec</TableHead>
                  <TableHead className="text-muted-foreground">Rec Yds</TableHead>
                  <TableHead className="text-muted-foreground">Tackles</TableHead>
                  <TableHead className="text-muted-foreground">Sacks</TableHead>
                  <TableHead className="text-muted-foreground">INT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerStats.map((p) => (
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.position}</TableCell>
                    <TableCell className="text-muted-foreground">{p.games_played}</TableCell>
                    <TableCell className="text-muted-foreground">{p.pass_yards || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.pass_tds || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.rush_yards || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.rush_tds || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.receptions || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.rec_yards || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.tackles || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sacks || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.interceptions_caught || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
