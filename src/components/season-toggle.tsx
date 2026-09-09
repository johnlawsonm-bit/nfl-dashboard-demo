"use client";

import { Button } from "@/components/ui/button";

export function SeasonToggle({
  value,
  onChange,
  seasons,
}: {
  value: number;
  onChange: (season: number) => void;
  seasons: number[];
}) {
  return (
    <div className="flex gap-2">
      {seasons.map((season) => (
        <Button
          key={season}
          size="sm"
          variant={value === season ? "default" : "outline"}
          className={
            value === season
              ? "bg-primary text-primary-foreground"
              : "border-border text-foreground"
          }
          onClick={() => onChange(season)}
        >
          {season} Season
        </Button>
      ))}
    </div>
  );
}
