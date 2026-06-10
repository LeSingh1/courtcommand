import raw from "./ftrate.real.json";

// Real free-throw rate (FTA per FGA) for current players, from this season's
// real ESPN box-score totals. A genuine proxy for foul-drawing pressure —
// who lives at the line — not a claim about referee intent.
export interface FtRate {
  espnId: number;
  name: string;
  team: string;
  fta: number;
  fga: number;
  ftr: number; // FTA / FGA
  ftp: number; // FT%
}

export const FT_RATES = raw as unknown as FtRate[];

export interface TeamFt {
  team: string;
  fta: number;
  fga: number;
  ftr: number;
  n: number;
}

export function teamFtRates(): TeamFt[] {
  const m = new Map<string, TeamFt>();
  for (const x of FT_RATES) {
    let e = m.get(x.team);
    if (!e) {
      e = { team: x.team, fta: 0, fga: 0, ftr: 0, n: 0 };
      m.set(x.team, e);
    }
    e.fta += x.fta;
    e.fga += x.fga;
    e.n++;
  }
  return [...m.values()]
    .map((e) => ({ ...e, ftr: e.fga ? e.fta / e.fga : 0 }))
    .sort((a, b) => b.ftr - a.ftr);
}

// ---- Outlier framing helpers ----
// A z-score says how unusual a player's FT rate is vs the pool — a neutral
// statistical statement, not a claim about officiating intent.
export interface FtOutlier extends FtRate {
  z: number; // z-score of this player's FTr vs the pool mean/std
  smallSample: boolean; // below ~200 season FGA even at a full 82-game pace
}

// Below this many season field-goal attempts, an FT rate is too noisy to read.
export const FT_SAMPLE_MIN_FGA = 200;

// fga may be a season total or (as in our box data) a per-game average; for
// per-game input the flag asks whether even a full 82-game season would clear
// the 200-attempt floor. Deterministic either way.
export function ftrSampleSizeWarning(fga: number, perGame = false): boolean {
  return (perGame ? fga * 82 : fga) < FT_SAMPLE_MIN_FGA;
}

export function ftrZScores(pool: FtRate[] = FT_RATES): FtOutlier[] {
  if (!pool.length) return [];
  const mean = pool.reduce((a, x) => a + x.ftr, 0) / pool.length;
  const std = Math.sqrt(pool.reduce((a, x) => a + (x.ftr - mean) ** 2, 0) / pool.length) || 1;
  return pool.map((x) => ({
    ...x,
    z: (x.ftr - mean) / std,
    smallSample: ftrSampleSizeWarning(x.fga, true),
  }));
}
