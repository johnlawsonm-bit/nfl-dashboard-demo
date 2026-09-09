export type Team = {
  id: string;
  name: string;
  city: string;
  conference: "AFC" | "NFC";
  division: "East" | "West" | "North" | "South";
  stadium_name: string | null;
  founded_year: number | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export type Coach = {
  id: string;
  team_id: string;
  name: string;
  role: string;
  hire_year: number | null;
  bio: string | null;
};

export type Player = {
  id: string;
  team_id: string;
  name: string;
  position: string;
  jersey_number: number;
  height_in: number | null;
  weight_lb: number | null;
  age: number | null;
  college: string | null;
  depth_chart_rank: number;
  status: "Active" | "Injured" | "Practice Squad" | "Inactive";
};

export type Game = {
  id: string;
  season: number;
  week: number;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: "Scheduled" | "Final";
  stadium_name: string | null;
};

export type TeamStats = {
  id: string;
  team_id: string;
  season: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  total_yards: number;
  passing_yards: number;
  rushing_yards: number;
  turnovers: number;
  sacks: number;
};

export type PlayerStats = {
  id: string;
  player_id: string;
  season: number;
  games_played: number;
  pass_yards: number;
  pass_tds: number;
  interceptions_thrown: number;
  rush_yards: number;
  rush_tds: number;
  receptions: number;
  rec_yards: number;
  rec_tds: number;
  tackles: number;
  sacks: number;
  interceptions_caught: number;
};

export type NewsItem = {
  id: string;
  headline: string;
  body: string;
  category: "General" | "Injury" | "Trade" | "Game Recap" | "Roster Move";
  team_id: string | null;
  published_at: string;
};
