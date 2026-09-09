// Generates a deterministic dummy dataset for the NFL Dashboard Demo and writes
// supabase/seed/seed.sql, which can be run against the Supabase project directly.
// All names, stats, and news are fictional.

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { faker } from "@faker-js/faker";
import { teams as teamSeeds, type TeamSeed } from "./teams";

faker.seed(42); // deterministic output across runs

const esc = (s: string) => s.replace(/'/g, "''");
const sqlStr = (s: string | null) => (s === null ? "null" : `'${esc(s)}'`);

type Row = Record<string, string | number | null>;

function insertStatements(table: string, rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const values = rows
    .map((row) => {
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null) return "null";
        if (typeof v === "number") return v.toString();
        return sqlStr(v);
      });
      return `  (${vals.join(", ")})`;
    })
    .join(",\n");
  return `insert into ${table} (${cols.join(", ")}) values\n${values};\n\n`;
}

// ---- Teams ----
const teamIds = new Map<string, string>(); // name -> uuid
const teamRows: Row[] = teamSeeds.map((t) => {
  const id = randomUUID();
  teamIds.set(t.name, id);
  return {
    id,
    name: t.name,
    city: t.city,
    conference: t.conference,
    division: t.division,
    stadium_name: t.stadium_name,
    founded_year: t.founded_year,
    primary_color: t.primary_color,
    secondary_color: t.secondary_color,
  };
});

// ---- Coaches ----
const coachRoles = [
  "Head Coach",
  "Offensive Coordinator",
  "Defensive Coordinator",
  "Special Teams Coordinator",
  "Quarterbacks Coach",
];
const coachRows: Row[] = [];
for (const t of teamSeeds) {
  const teamId = teamIds.get(t.name)!;
  for (const role of coachRoles) {
    coachRows.push({
      id: randomUUID(),
      team_id: teamId,
      name: faker.person.fullName(),
      role,
      hire_year: faker.number.int({ min: 2018, max: 2026 }),
      bio: `${role} bringing ${faker.number.int({ min: 2, max: 25 })} years of coaching experience to the ${t.name}.`,
    });
  }
}

// ---- Players ----
const rosterPlan: { position: string; count: number }[] = [
  { position: "QB", count: 3 },
  { position: "RB", count: 4 },
  { position: "WR", count: 7 },
  { position: "TE", count: 3 },
  { position: "OL", count: 9 },
  { position: "DL", count: 8 },
  { position: "LB", count: 7 },
  { position: "CB", count: 6 },
  { position: "S", count: 4 },
  { position: "K", count: 1 },
  { position: "P", count: 1 },
];

type PlayerMeta = { id: string; teamId: string; position: string; depthRank: number };
const playerRows: Row[] = [];
const playerMeta: PlayerMeta[] = [];

for (const t of teamSeeds) {
  const teamId = teamIds.get(t.name)!;
  const usedNumbers = new Set<number>();
  for (const { position, count } of rosterPlan) {
    for (let rank = 1; rank <= count; rank++) {
      let jersey = faker.number.int({ min: 1, max: 99 });
      while (usedNumbers.has(jersey)) jersey = faker.number.int({ min: 1, max: 99 });
      usedNumbers.add(jersey);

      const id = randomUUID();
      const status = faker.helpers.weightedArrayElement([
        { value: "Active", weight: 90 },
        { value: "Injured", weight: 6 },
        { value: "Practice Squad", weight: 4 },
      ]);

      playerRows.push({
        id,
        team_id: teamId,
        name: faker.person.fullName(),
        position,
        jersey_number: jersey,
        height_in: faker.number.int({ min: 68, max: 82 }),
        weight_lb: faker.number.int({ min: 175, max: 335 }),
        age: faker.number.int({ min: 21, max: 37 }),
        college: faker.location.state(),
        depth_chart_rank: rank,
        status,
      });
      playerMeta.push({ id, teamId, position, depthRank: rank });
    }
  }
}

// ---- Games (2 seasons: PREVIOUS_SEASON fully final, CURRENT_SEASON partially played) ----
const PREVIOUS_SEASON = 2025;
const CURRENT_SEASON = 2026;
const WEEKS_PER_SEASON = 17;
const CURRENT_SEASON_WEEKS_PLAYED = 2; // "today" is early Sept 2026 - season just started

const gameRows: Row[] = [];
const teamStatsAgg = new Map<string, { wins: number; losses: number; ties: number; pf: number; pa: number }>();

function keyFor(teamId: string, season: number) {
  return `${teamId}|${season}`;
}

function buildSeasonGames(season: number, weeksPlayed: number) {
  const teamIdsList = teamSeeds.map((t) => teamIds.get(t.name)!);
  for (const id of teamIdsList) {
    teamStatsAgg.set(keyFor(id, season), { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 });
  }

  for (let week = 1; week <= WEEKS_PER_SEASON; week++) {
    const shuffled = faker.helpers.shuffle([...teamIdsList]);
    const isPlayed = week <= weeksPlayed;
    const gameDate = new Date(season, 8, 1 + (week - 1) * 7); // Sept 1 + week offset

    for (let i = 0; i < shuffled.length; i += 2) {
      const homeTeamId = shuffled[i];
      const awayTeamId = shuffled[i + 1];
      let homeScore: number | null = null;
      let awayScore: number | null = null;

      if (isPlayed) {
        homeScore = faker.number.int({ min: 6, max: 42 });
        awayScore = faker.number.int({ min: 6, max: 42 });

        const home = teamStatsAgg.get(keyFor(homeTeamId, season))!;
        const away = teamStatsAgg.get(keyFor(awayTeamId, season))!;
        home.pf += homeScore;
        home.pa += awayScore;
        away.pf += awayScore;
        away.pa += homeScore;
        if (homeScore > awayScore) {
          home.wins++;
          away.losses++;
        } else if (awayScore > homeScore) {
          away.wins++;
          home.losses++;
        } else {
          home.ties++;
          away.ties++;
        }
      }

      gameRows.push({
        id: randomUUID(),
        season,
        week,
        game_date: gameDate.toISOString(),
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_score: homeScore,
        away_score: awayScore,
        status: isPlayed ? "Final" : "Scheduled",
        stadium_name: null,
      });
    }
  }
}

buildSeasonGames(PREVIOUS_SEASON, WEEKS_PER_SEASON);
buildSeasonGames(CURRENT_SEASON, CURRENT_SEASON_WEEKS_PLAYED);

// ---- Team stats ----
const teamStatsRows: Row[] = [];
for (const t of teamSeeds) {
  const teamId = teamIds.get(t.name)!;
  for (const season of [PREVIOUS_SEASON, CURRENT_SEASON]) {
    const agg = teamStatsAgg.get(keyFor(teamId, season))!;
    teamStatsRows.push({
      id: randomUUID(),
      team_id: teamId,
      season,
      wins: agg.wins,
      losses: agg.losses,
      ties: agg.ties,
      points_for: agg.pf,
      points_against: agg.pa,
      total_yards: faker.number.int({ min: 4500, max: 6800 }),
      passing_yards: faker.number.int({ min: 2500, max: 4500 }),
      rushing_yards: faker.number.int({ min: 1200, max: 2600 }),
      turnovers: faker.number.int({ min: 8, max: 30 }),
      sacks: faker.number.int({ min: 20, max: 55 }),
    });
  }
}

// ---- Player stats ----
const playerStatsRows: Row[] = [];
for (const p of playerMeta) {
  for (const season of [PREVIOUS_SEASON, CURRENT_SEASON]) {
    const gamesPlayed =
      season === CURRENT_SEASON
        ? faker.number.int({ min: 0, max: CURRENT_SEASON_WEEKS_PLAYED })
        : faker.number.int({ min: 8, max: WEEKS_PER_SEASON });

    const scale = gamesPlayed / WEEKS_PER_SEASON;
    const stat: Row = {
      id: randomUUID(),
      player_id: p.id,
      season,
      games_played: gamesPlayed,
      pass_yards: 0,
      pass_tds: 0,
      interceptions_thrown: 0,
      rush_yards: 0,
      rush_tds: 0,
      receptions: 0,
      rec_yards: 0,
      rec_tds: 0,
      tackles: 0,
      sacks: 0,
      interceptions_caught: 0,
    };

    const scaled = (min: number, max: number) => Math.round(faker.number.int({ min, max }) * scale);

    switch (p.position) {
      case "QB":
        stat.pass_yards = scaled(1800, 4800);
        stat.pass_tds = scaled(12, 42);
        stat.interceptions_thrown = scaled(3, 18);
        stat.rush_yards = scaled(20, 350);
        break;
      case "RB":
        stat.rush_yards = scaled(200, 1600);
        stat.rush_tds = scaled(1, 16);
        stat.receptions = scaled(10, 60);
        stat.rec_yards = scaled(80, 500);
        break;
      case "WR":
      case "TE":
        stat.receptions = scaled(15, 100);
        stat.rec_yards = scaled(200, 1500);
        stat.rec_tds = scaled(1, 13);
        break;
      case "DL":
      case "LB":
        stat.tackles = scaled(20, 130);
        stat.sacks = scaled(0, 15);
        stat.interceptions_caught = p.position === "LB" ? scaled(0, 3) : 0;
        break;
      case "CB":
      case "S":
        stat.tackles = scaled(15, 90);
        stat.interceptions_caught = scaled(0, 6);
        break;
      case "K":
      case "P":
      default:
        break;
    }

    playerStatsRows.push(stat);
  }
}

// ---- News ----
const newsCategories = ["General", "Injury", "Trade", "Game Recap", "Roster Move"] as const;
const headlineTemplates: Record<(typeof newsCategories)[number], (name: string) => string> = {
  General: (name) => `${name} Preps for Pivotal Week Ahead`,
  Injury: (name) => `${name} Provides Update on Starter's Injury Status`,
  Trade: (name) => `${name} Completes Trade Ahead of Deadline`,
  "Game Recap": (name) => `${name} Comes Out on Top in Hard-Fought Matchup`,
  "Roster Move": (name) => `${name} Adjusts Roster With Latest Signing`,
};

const bodyParts = ["knee", "ankle", "hamstring", "shoulder", "wrist", "groin", "concussion protocol", "back"];
const designations = ["questionable", "doubtful", "out"];
const returnWindows = ["week-to-week", "2 to 4 weeks", "roughly a month", "the rest of the season", "just a few days"];
const rosterMoveTypes = ["signed", "waived", "placed on injured reserve", "activated from the practice squad", "released"];
const draftRounds = ["first-round", "second-round", "third-round", "fourth-round", "late-round", "conditional"];

function pick<T>(arr: T[]): T {
  return faker.helpers.arrayElement(arr);
}

function otherTeam(exclude: TeamSeed): TeamSeed {
  let candidate = pick(teamSeeds);
  while (candidate.name === exclude.name) candidate = pick(teamSeeds);
  return candidate;
}

function buildBody(category: (typeof newsCategories)[number], team: TeamSeed): string {
  const player = faker.person.fullName();
  const week = faker.number.int({ min: 1, max: 17 });

  switch (category) {
    case "General": {
      const focus = pick(["red zone efficiency", "third-down conversions", "pass protection", "run defense", "special teams coverage"]);
      return [
        `The ${team.name} used this week's practices to sharpen ${focus} ahead of a Week ${week} matchup that could shift the standings in the ${team.conference} ${team.division}.`,
        `Coaches described the mood around the facility as focused, with veterans taking a heavier hand in walkthroughs and rookies pushing for expanded roles. ${player} has drawn praise from teammates for his preparation this week.`,
        `Beat reporters expect a full injury report by Friday, but for now the ${team.name} appear to be trending toward full health heading into the weekend.`,
      ].join("\n\n");
    }
    case "Injury": {
      const part = pick(bodyParts);
      const designation = pick(designations);
      const window = pick(returnWindows);
      return [
        `${player} is dealing with a ${part} issue and has been listed as ${designation} for the ${team.name}'s upcoming game.`,
        `The team's medical staff is calling the timeline ${window}, and the coaching staff has already begun preparing a backup plan in case ${player} is unavailable.`,
        `"We'll know more as the week goes on," the team said in a statement. "Right now the priority is making sure he's fully healthy before he's back on the field."`,
      ].join("\n\n");
    }
    case "Trade": {
      const partner = otherTeam(team);
      const pos = pick(["quarterback", "running back", "wide receiver", "tight end", "offensive lineman", "defensive lineman", "linebacker", "cornerback", "safety"]);
      const round = pick(draftRounds);
      return [
        `The ${team.name} have completed a trade with the ${partner.name}, sending draft compensation in exchange for a starting-caliber ${pos}.`,
        `In return, the ${partner.name} receive a ${round} draft pick as the primary piece of the deal.`,
        `Both front offices described the trade as a move to address immediate roster needs, with the newly acquired player expected to report to his new team before the next practice window.`,
      ].join("\n\n");
    }
    case "Game Recap": {
      const opponent = otherTeam(team);
      const teamScore = faker.number.int({ min: 14, max: 42 });
      let oppScore = faker.number.int({ min: 6, max: teamScore - 1 });
      if (oppScore < 0) oppScore = 0;
      const yards = faker.number.int({ min: 65, max: 180 });
      return [
        `The ${team.name} defeated the ${opponent.name} ${teamScore}-${oppScore} in a matchup that was tighter than the final score suggests.`,
        `${player} was the standout performer, finishing with ${yards} total yards and drawing praise from the coaching staff after the game.`,
        `The win moves the ${team.name} closer to the top of the ${team.conference} ${team.division} standings as they turn their attention to next week's opponent.`,
      ].join("\n\n");
    }
    case "Roster Move": {
      const move = pick(rosterMoveTypes);
      const pos = pick(["quarterback", "running back", "wide receiver", "tight end", "offensive lineman", "defensive lineman", "linebacker", "cornerback", "safety", "kicker"]);
      return [
        `The ${team.name} have ${move} ${player}, a ${pos}, as part of a series of roster adjustments this week.`,
        `The move is expected to provide the team with additional depth heading into the coming weeks, and the coaching staff says the transition should be seamless.`,
        `More roster moves are expected as the ${team.name} continue to fine-tune their depth chart for the rest of the season.`,
      ].join("\n\n");
    }
  }
}

const newsRows: Row[] = [];
const NEWS_COUNT = 150;
for (let i = 0; i < NEWS_COUNT; i++) {
  const team = faker.helpers.arrayElement(teamSeeds);
  const category = faker.helpers.arrayElement(newsCategories);
  const teamId = teamIds.get(team.name)!;
  newsRows.push({
    id: randomUUID(),
    headline: headlineTemplates[category](team.name),
    body: buildBody(category, team),
    category,
    team_id: teamId,
    published_at: faker.date.recent({ days: 60 }).toISOString(),
  });
}

// ---- Write SQL ----
let sql = "-- Auto-generated dummy seed data. Do not edit by hand; edit generate.ts and re-run.\n\n";
sql += insertStatements("teams", teamRows);
sql += insertStatements("coaches", coachRows);
sql += insertStatements("players", playerRows);
sql += insertStatements(
  "games",
  gameRows.map((g) => ({ ...g }))
);
sql += insertStatements("team_stats", teamStatsRows);
sql += insertStatements("player_stats", playerStatsRows);
sql += insertStatements("news", newsRows);

writeFileSync(new URL("./seed.sql", import.meta.url), sql);

console.log(`Generated seed.sql:
  teams: ${teamRows.length}
  coaches: ${coachRows.length}
  players: ${playerRows.length}
  games: ${gameRows.length}
  team_stats: ${teamStatsRows.length}
  player_stats: ${playerStatsRows.length}
  news: ${newsRows.length}`);
