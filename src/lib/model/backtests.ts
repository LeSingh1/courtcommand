import tools from "./backtests/tools.json";

// Model track-record data — what each model predicted vs what really happened,
// season by season back to 2003, plus the real per-season training history that
// shows the model learning. Produced by model/backtest.py from real data.

export interface HistoryPoint {
  year: number;
  season: string;
  rows: number;
  players: number;
}
export interface AwardSeason {
  year: number;
  season: string;
  actual: string;
  predicted: string;
  correct: boolean;
}
export interface RaceCandidate {
  name: string;
  modelShare: number;
  actualShare: number;
}
export interface Race {
  year: number;
  season: string;
  candidates: RaceCandidate[];
}
export interface ProjSeason {
  year: number;
  season: string;
  mae: number;
  n: number;
}
export interface SeriesSeason {
  year: number;
  season: string;
  value: number;
  n: number;
}
export interface CalBucket {
  bucket: string;
  observed: number;
  predicted: number;
  n: number;
}

export interface TrackRecord {
  slug: string;
  kind: "awards" | "projection" | "calibration" | "champions" | "ncaa" | "series" | "metric" | "validation";
  league?: string;
  metric: string;
  headline: string;
  accuracy: number | null;
  method: string;
  span: string;
  trainedOn: string;
  history: HistoryPoint[];
  seasons?: (AwardSeason | ProjSeason | SeriesSeason)[];
  races?: Race[];
  calibration?: CalBucket[];
  champions?: Record<string, string>;
  seriesLabel?: string;
  betterHigh?: boolean;
  unit?: string;
}

const TOOLS = tools as unknown as Record<string, TrackRecord>;

export function trackRecord(slug: string): TrackRecord | null {
  return TOOLS[slug] ?? null;
}

export function isAwardSeason(s: AwardSeason | ProjSeason): s is AwardSeason {
  return (s as AwardSeason).actual !== undefined;
}
