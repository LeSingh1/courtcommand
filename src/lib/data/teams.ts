import type { Team } from "@/lib/types";
import real from "./teams.real.json";

// Real teams with real records, colors, and payroll (sum of real player
// salaries), ingested from ESPN by scripts/ingest-espn.mjs.
export const TEAMS: Team[] = (real as unknown as Team[])
  .slice()
  .sort((a, b) => a.abbr.localeCompare(b.abbr));

export const TEAM_MAP: Record<string, Team> = Object.fromEntries(TEAMS.map((x) => [x.abbr, x]));

// Real 2025-26 salary-cap landmarks ($M).
export const SALARY_CAP = 154.6;
export const LUXURY_TAX = 187.9;
export const FIRST_APRON = 195.9;
export const SECOND_APRON = 207.8;
