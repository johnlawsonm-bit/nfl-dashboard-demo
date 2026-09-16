"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type GameProjection = {
  week: number;
  opponent_team_id: string;
  opponent_name: string;
  is_home: boolean;
  team_expected_points: number;
  opponent_expected_points: number;
  team_win_probability: number;
};

type ProjectionResponse = {
  team: { id: string; name: string; city: string };
  season: number;
  current_record: {
    wins: number;
    losses: number;
    ties: number;
    games_played: number;
    points_for: number;
    points_against: number;
  };
  previous_season_win_total: { season: number; wins: number; losses: number };
  remaining_schedule: GameProjection[];
  projection: {
    remaining_games: number;
    projected_remaining_wins: number;
    projected_remaining_losses: number;
    projected_final_wins: number;
    projected_final_losses: number;
    projected_final_wins_rounded: number;
    projected_final_losses_rounded: number;
    projected_final_record: string;
    avg_expected_points_remaining_games: number | null;
  };
};

const API_URL = process.env.NEXT_PUBLIC_PROJECTIONS_API_URL;

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="team-name text-xl">{value}</p>
    </div>
  );
}

export function ProjectionsTab({ teamId }: { teamId: string }) {
  const [data, setData] = useState<ProjectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    if (!API_URL) {
      setError("Projection API is not configured (missing NEXT_PUBLIC_PROJECTIONS_API_URL).");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`${API_URL}/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.detail
              ? typeof body.detail === "string"
                ? body.detail
                : JSON.stringify(body.detail)
              : `Projection API returned ${res.status}`
          );
        }
        return res.json() as Promise<ProjectionResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-muted" />
          ))}
        </div>
        <Skeleton className="h-64 w-full bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-card">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Couldn&apos;t load season projections: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { current_record, previous_season_win_total, projection, remaining_schedule, season } = data;

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="team-name">Season Projection — {season}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Current Record"
              value={`${current_record.wins}-${current_record.losses}${current_record.ties ? `-${current_record.ties}` : ""}`}
            />
            <StatTile
              label={`Prev. Season (${previous_season_win_total.season}) Wins`}
              value={`${previous_season_win_total.wins}-${previous_season_win_total.losses}`}
            />
            <StatTile label="Projected Remaining Wins" value={projection.projected_remaining_wins.toFixed(1)} />
            <StatTile label="Projected Final Record" value={projection.projected_final_record} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Projected Final Wins" value={projection.projected_final_wins.toFixed(1)} />
            <StatTile label="Projected Final Losses" value={projection.projected_final_losses.toFixed(1)} />
            <StatTile label="Games Remaining" value={projection.remaining_games} />
            <StatTile
              label="Avg. Expected Points / Game"
              value={projection.avg_expected_points_remaining_games ?? "—"}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="team-name mb-3 text-lg">Remaining Schedule &amp; Projections</h3>
        {remaining_schedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">No remaining games this season.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Week</TableHead>
                  <TableHead className="text-muted-foreground">Opponent</TableHead>
                  <TableHead className="text-muted-foreground">Exp. Pts (Team)</TableHead>
                  <TableHead className="text-muted-foreground">Exp. Pts (Opp)</TableHead>
                  <TableHead className="text-muted-foreground">Win Prob.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remaining_schedule.map((g) => (
                  <TableRow key={g.week} className="border-border">
                    <TableCell className="text-foreground">{g.week}</TableCell>
                    <TableCell className="text-foreground">
                      {g.is_home ? "vs" : "@"} <span className="team-name">{g.opponent_name}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{g.team_expected_points.toFixed(1)}</TableCell>
                    <TableCell className="text-muted-foreground">{g.opponent_expected_points.toFixed(1)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          g.team_win_probability >= 0.5
                            ? "bg-primary/20 text-primary"
                            : "bg-destructive/20 text-destructive"
                        }
                      >
                        {Math.round(g.team_win_probability * 100)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Projections come from a scikit-learn model trained on each team&apos;s prior-season and
        current-season results, served live from the projection API — not hard-coded.
      </p>
    </div>
  );
}
