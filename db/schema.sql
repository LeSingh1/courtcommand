-- CourtCommand — Postgres / Supabase schema
-- The app currently runs on the in-memory engine in src/lib/data. To go live,
-- create these tables, seed them with `npx tsx scripts/seed.ts`, and point the
-- API routes in src/app/api/* at the database instead of the mock engine.

create table if not exists teams (
  abbr        text primary key,
  name        text not null,
  city        text not null,
  conference  text not null check (conference in ('East','West')),
  division    text not null,
  color       text not null,
  color2      text not null,
  wins        int  not null default 0,
  losses      int  not null default 0,
  ortg        numeric(5,1),
  drtg        numeric(5,1),
  pace        numeric(5,1),
  payroll     numeric(6,1)               -- $M
);

create table if not exists players (
  id          text primary key,
  name        text not null,
  team        text references teams(abbr),
  pos         text not null check (pos in ('PG','SG','SF','PF','C')),
  age         int,
  height_in   int,
  weight_lb   int,
  experience  int,
  salary      numeric(6,1),              -- $M, current year
  gp          int,
  mpg         numeric(4,1),
  ppg         numeric(4,1),
  rpg         numeric(4,1),
  apg         numeric(4,1),
  spg         numeric(4,1),
  bpg         numeric(4,1),
  topg        numeric(4,1),
  fg_pct      numeric(4,3),
  tp_pct      numeric(4,3),
  ft_pct      numeric(4,3),
  tpa         numeric(4,1),              -- 3PA per game
  usage       numeric(4,1),
  ts_pct      numeric(4,3),
  per         numeric(4,1),
  bpm         numeric(4,1),
  net_rtg     numeric(4,1),
  updated_at  timestamptz default now()
);
create index if not exists players_team_idx on players(team);
create index if not exists players_pos_idx  on players(pos);

-- Per-shot fact table for the shot-quality + shot-chart engines.
create table if not exists shots (
  id          bigserial primary key,
  player_id   text references players(id),
  game_id     text,
  period      int,
  x           numeric(6,2),              -- court x (0..500)
  y           numeric(6,2),              -- court y (0..470)
  shot_type   text,                      -- rim|floater|midrange|catch3|pullup3|stepback3
  defender_dist numeric(4,1),
  shot_clock  numeric(4,1),
  touch_time  numeric(4,1),
  dribbles    int,
  made        boolean,
  created_at  timestamptz default now()
);
create index if not exists shots_player_idx on shots(player_id);

-- Multi-year salary table for the trade machine + contract analyzer.
create table if not exists contracts (
  id          bigserial primary key,
  player_id   text references players(id),
  season      text,                      -- e.g. '2024-25'
  cap_hit     numeric(6,1),              -- $M
  guaranteed  boolean default true,
  player_option boolean default false
);

-- Cap constants by season (apron/tax thresholds).
create table if not exists cap_rules (
  season       text primary key,
  salary_cap   numeric(6,1),
  luxury_tax   numeric(6,1),
  first_apron  numeric(6,1),
  second_apron numeric(6,1)
);
