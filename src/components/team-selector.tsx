"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Team } from "@/lib/types";

export function TeamSelector({
  teams,
  value,
  onChange,
}: {
  teams: Team[];
  value: string;
  onChange: (teamId: string) => void;
}) {
  const groups = new Map<string, Team[]>();
  for (const team of teams) {
    const key = `${team.conference} ${team.division}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(team);
  }
  const sortedGroupKeys = [...groups.keys()].sort();

  const nameById = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-full sm:w-72 border-border bg-card text-foreground">
        <SelectValue placeholder="Select a team">
          {(v: string | null) => (v ? (nameById.get(v) ?? v) : "Select a team")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-card text-foreground">
        {sortedGroupKeys.map((groupKey) => (
          <SelectGroup key={groupKey}>
            <SelectLabel className="text-muted-foreground">{groupKey}</SelectLabel>
            {groups
              .get(groupKey)!
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
