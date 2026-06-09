export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type Conference = "East" | "West";

export interface RawPlayer {
  id: string;
  espnId?: number; // ESPN athlete id (headshots + provenance)
  name: string;
  team: string; // team abbreviation
  pos: Position;
  age: number;
  htIn: number; // height in inches
  wtLb: number;
  exp: number; // years of experience
  salary: number; // current-year salary in $M
  gp: number; // games played
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number; // turnovers
  fgp: number; // FG%
  tpp: number; // 3P%
  ftp: number; // FT%
  tpa: number; // 3PA per game
  usg: number; // usage %
  tsp: number; // true shooting %
  per: number;
  bpm: number;
  netRtg: number; // on-court net rating swing
}

export interface Player extends RawPlayer {
  // derived
  shotRim: number; // share of FGA
  shotMid: number;
  shotThree: number;
  clutchPpg: number;
  clutchFgp: number;
  clutchUsg: number;
  defReb: number;
  defImpact: number; // 0-100 composite
  offImpact: number; // 0-100 composite
  injuryRisk: number; // 0-100
  ortg: number;
  drtg: number;
  archetype: string;
  starPower: number; // 0-100
  efficiency: number; // 0-100
}

export interface Team {
  abbr: string;
  name: string;
  city: string;
  conf: Conference;
  div: string;
  color: string;
  color2: string;
  wins: number;
  losses: number;
  ortg: number;
  drtg: number;
  pace: number;
  payroll: number; // $M
}

export interface ToolMeta {
  slug: string;
  name: string;
  short: string;
  tagline: string;
  category: ToolCategory;
  accent: "ember" | "cyan" | "gold" | "mint" | "rose";
  icon: string; // lucide icon name
  keywords: string[];
}

export type ToolCategory =
  | "Prediction"
  | "Player Analysis"
  | "Team & Strategy"
  | "Content & Media"
  | "Player Tools";
