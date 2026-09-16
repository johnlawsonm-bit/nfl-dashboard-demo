"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Newspaper,
  Headphones,
  Presentation,
  Calendar,
  ClipboardList,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { TeamSelector } from "@/components/team-selector";
import { SeasonToggle } from "@/components/season-toggle";
import { TabAnimatedIcon } from "@/components/tab-animated-icon";
import { FootballIcon } from "@/components/icons/football-icon";
import { GoalpostIcon } from "@/components/icons/goalpost-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewsTab } from "@/components/tabs/news-tab";
import { RosterTab } from "@/components/tabs/roster-tab";
import { CoachesTab } from "@/components/tabs/coaches-tab";
import { ScheduleTab } from "@/components/tabs/schedule-tab";
import { StatsTab } from "@/components/tabs/stats-tab";
import { ResultsTab } from "@/components/tabs/results-tab";
import { ProjectionsTab } from "@/components/tabs/projections-tab";

const SEASONS = [2026, 2025];

const TABS = [
  { value: "news", label: "News", icons: [Newspaper], needsTeam: false, needsSeason: false },
  {
    value: "roster",
    label: "Rosters & Depth Charts",
    icons: [FootballIcon, GoalpostIcon],
    needsTeam: true,
    needsSeason: false,
  },
  {
    value: "coaches",
    label: "Coaches",
    icons: [Headphones, Presentation],
    needsTeam: true,
    needsSeason: false,
  },
  {
    value: "schedule",
    label: "Schedules",
    icons: [Calendar, FootballIcon],
    needsTeam: true,
    needsSeason: true,
  },
  {
    value: "stats",
    label: "Stats",
    icons: [ClipboardList],
    needsTeam: true,
    needsSeason: true,
  },
  {
    value: "results",
    label: "Results",
    icons: [Trophy, GoalpostIcon],
    needsTeam: true,
    needsSeason: true,
  },
  {
    value: "projections",
    label: "Season Projections",
    icons: [TrendingUp],
    needsTeam: true,
    needsSeason: false,
  },
] as const;

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [season, setSeason] = useState<number>(SEASONS[0]);
  const [activeTab, setActiveTab] = useState<string>("news");

  useEffect(() => {
    supabase
      .from("teams")
      .select("*")
      .then(({ data }) => {
        const rows = (data as Team[]) ?? [];
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(rows);
        if (rows.length > 0) setSelectedTeamId(rows[0].id);
      });
  }, []);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const currentTab = TABS.find((t) => t.value === activeTab)!;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-card">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabAnimatedIcon tabKey={activeTab} icons={[...currentTab.icons]} label={currentTab.label} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {currentTab.needsTeam && teams.length > 0 && (
                <TeamSelector teams={teams} value={selectedTeamId} onChange={setSelectedTeamId} />
              )}
              {currentTab.needsSeason && (
                <SeasonToggle value={season} onChange={setSeason} seasons={[...SEASONS]} />
              )}
            </div>
          </div>

          <div className="mt-6">
            <TabsContent value="news">
              <NewsTab teamsById={teamsById} />
            </TabsContent>
            <TabsContent value="roster">
              {selectedTeamId && <RosterTab key={selectedTeamId} teamId={selectedTeamId} />}
            </TabsContent>
            <TabsContent value="coaches">
              {selectedTeamId && <CoachesTab key={selectedTeamId} teamId={selectedTeamId} />}
            </TabsContent>
            <TabsContent value="schedule">
              {selectedTeamId && (
                <ScheduleTab
                  key={`${selectedTeamId}-${season}`}
                  teamId={selectedTeamId}
                  season={season}
                  teamsById={teamsById}
                />
              )}
            </TabsContent>
            <TabsContent value="stats">
              {selectedTeamId && (
                <StatsTab key={`${selectedTeamId}-${season}`} teamId={selectedTeamId} season={season} />
              )}
            </TabsContent>
            <TabsContent value="results">
              {selectedTeamId && (
                <ResultsTab
                  key={`${selectedTeamId}-${season}`}
                  teamId={selectedTeamId}
                  season={season}
                  teamsById={teamsById}
                />
              )}
            </TabsContent>
            <TabsContent value="projections">
              {selectedTeamId && <ProjectionsTab key={selectedTeamId} teamId={selectedTeamId} />}
            </TabsContent>
          </div>
        </Tabs>
      </main>
      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        Gridiron Dashboard is a fictional demo project. All teams, players, and
        stats are dummy data — not real, not affiliated with the NFL.
      </footer>
    </div>
  );
}
