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
