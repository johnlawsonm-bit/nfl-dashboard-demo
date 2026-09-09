"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Coach } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_ORDER = [
  "Head Coach",
  "Offensive Coordinator",
  "Defensive Coordinator",
  "Special Teams Coordinator",
  "Quarterbacks Coach",
];

export function CoachesTab({ teamId }: { teamId: string }) {
  const [coaches, setCoaches] = useState<Coach[] | null>(null);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    supabase
      .from("coaches")
      .select("*")
      .eq("team_id", teamId)
      .then(({ data }) => {
        if (!cancelled) {
          const rows = (data as Coach[]) ?? [];
          rows.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
          setCoaches(rows);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (!coaches) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {coaches.map((coach) => (
        <Card key={coach.id} className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">{coach.name}</CardTitle>
            <p className="team-name text-sm">{coach.role}</p>
          </CardHeader>
          <CardContent className="space-y-1">
            {coach.hire_year && (
              <p className="text-xs text-muted-foreground">Hired {coach.hire_year}</p>
            )}
            {coach.bio && <p className="text-sm text-muted-foreground">{coach.bio}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
