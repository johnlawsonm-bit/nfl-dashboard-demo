-- NFL Dashboard Demo schema
-- All data loaded against this schema is fictional/dummy data.

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- generic, e.g. "Chicago Football Team" (no real nicknames/logos)
  city text not null,                 -- real NFL city; cities with 2 teams get name suffixed "1"/"2"
  conference text not null check (conference in ('AFC', 'NFC')),
  division text not null check (division in ('East', 'West', 'North', 'South')),
  stadium_name text,
  founded_year int,
  primary_color text,                 -- hex, for accenting team name text
  secondary_color text,
  created_at timestamptz not null default now()
);

create table coaches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  role text not null,                 -- 'Head Coach', 'Offensive Coordinator', 'Defensive Coordinator', 'Special Teams Coordinator'
  hire_year int,
  bio text,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  position text not null,             -- QB, RB, WR, TE, OL, DL, LB, CB, S, K, P
  jersey_number int not null,
  height_in int,
  weight_lb int,
  age int,
  college text,
  depth_chart_rank int not null default 1,  -- 1 = starter, 2 = backup, etc. (per team+position)
  status text not null default 'Active' check (status in ('Active', 'Injured', 'Practice Squad', 'Inactive')),
  created_at timestamptz not null default now(),
  unique (team_id, jersey_number)
);

create table games (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  week int not null,
  game_date timestamptz not null,
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  home_score int,
  away_score int,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Final')),
  stadium_name text,
  created_at timestamptz not null default now()
);

create table team_stats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  season int not null,
  wins int not null default 0,
  losses int not null default 0,
  ties int not null default 0,
  points_for int not null default 0,
  points_against int not null default 0,
  total_yards int not null default 0,
  passing_yards int not null default 0,
  rushing_yards int not null default 0,
  turnovers int not null default 0,
  sacks int not null default 0,
  created_at timestamptz not null default now(),
  unique (team_id, season)
);

create table player_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  season int not null,
  games_played int not null default 0,
  pass_yards int not null default 0,
  pass_tds int not null default 0,
  interceptions_thrown int not null default 0,
  rush_yards int not null default 0,
  rush_tds int not null default 0,
  receptions int not null default 0,
  rec_yards int not null default 0,
  rec_tds int not null default 0,
  tackles int not null default 0,
  sacks numeric(4,1) not null default 0,
  interceptions_caught int not null default 0,
  created_at timestamptz not null default now(),
  unique (player_id, season)
);

create table news (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  body text not null,
  category text not null default 'General' check (category in ('General', 'Injury', 'Trade', 'Game Recap', 'Roster Move')),
  team_id uuid references teams(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_players_team on players(team_id);
create index idx_coaches_team on coaches(team_id);
create index idx_games_home on games(home_team_id);
create index idx_games_away on games(away_team_id);
create index idx_team_stats_team_season on team_stats(team_id, season);
create index idx_player_stats_player_season on player_stats(player_id, season);
create index idx_news_team on news(team_id);
create index idx_news_published on news(published_at desc);

-- Public read-only access (dummy data, no auth needed for a demo site)
alter table teams enable row level security;
alter table coaches enable row level security;
alter table players enable row level security;
alter table games enable row level security;
alter table team_stats enable row level security;
alter table player_stats enable row level security;
alter table news enable row level security;

create policy "public read" on teams for select using (true);
create policy "public read" on coaches for select using (true);
create policy "public read" on players for select using (true);
create policy "public read" on games for select using (true);
create policy "public read" on team_stats for select using (true);
create policy "public read" on player_stats for select using (true);
create policy "public read" on news for select using (true);
