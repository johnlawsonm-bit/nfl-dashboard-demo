"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { NewsItem, Team } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const categoryColor: Record<NewsItem["category"], string> = {
  General: "bg-secondary text-secondary-foreground",
  Injury: "bg-destructive/20 text-destructive",
  Trade: "bg-accent text-accent-foreground",
  "Game Recap": "bg-primary/20 text-primary",
  "Roster Move": "bg-accent text-accent-foreground",
};

export function NewsTab({ teamsById }: { teamsById: Map<string, Team> }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("news")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!cancelled) setNews((data as NewsItem[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!news) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {news.map((item) => {
        const team = item.team_id ? teamsById.get(item.team_id) : undefined;
        return (
          <Card key={item.id} className="border-border bg-card">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={categoryColor[item.category]}>{item.category}</Badge>
                {team && <span className="team-name text-xs">{team.name}</span>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(item.published_at).toLocaleDateString()}
                </span>
              </div>
              <CardTitle className="text-base text-foreground">{item.headline}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{item.body}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
