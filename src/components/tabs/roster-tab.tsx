"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Player } from "@/lib/types";
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

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K", "P"];

const statusColor: Record<Player["status"], string> = {
  Active: "bg-primary/20 text-primary",
  Injured: "bg-destructive/20 text-destructive",
  "Practice Squad": "bg-muted text-muted-foreground",
  Inactive: "bg-muted text-muted-foreground",
};

export function RosterTab({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[] | null>(null);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .order("position")
      .order("depth_chart_rank")
      .then(({ data }) => {
        if (!cancelled) setPlayers((data as Player[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (!players) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-muted" />
        ))}
      </div>
    );
  }

  const byPosition = new Map<string, Player[]>();
  for (const p of players) {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position)!.push(p);
  }

  const positions = POSITION_ORDER.filter((pos) => byPosition.has(pos));

  return (
    <div className="space-y-8">
      {positions.map((pos) => (
        <div key={pos}>
          <h3 className="team-name mb-2 text-lg">{pos}</h3>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Depth</TableHead>
                  <TableHead className="text-muted-foreground">#</TableHead>
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Ht/Wt</TableHead>
                  <TableHead className="text-muted-foreground">Age</TableHead>
                  <TableHead className="text-muted-foreground">College</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPosition.get(pos)!.map((p) => (
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="text-foreground">
                      {p.depth_chart_rank === 1 ? "Starter" : `${p.depth_chart_rank}`}
                    </TableCell>
                    <TableCell className="text-foreground">{p.jersey_number}</TableCell>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.height_in ? `${Math.floor(p.height_in / 12)}'${p.height_in % 12}"` : "—"}
                      {p.weight_lb ? ` / ${p.weight_lb} lb` : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.age ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.college ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[p.status]}>{p.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
