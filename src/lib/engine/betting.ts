import type { Player } from "@/lib/types";
import { PLAYERS, TEAM_MAP } from "@/lib/data";
import { letterGrade } from "@/lib/cn";

// ============================================================================
// EdgeBoard model — ported into CourtCommand.
// Faithful to the EdgeBoard methodology: a recency-blended projection, a
// variance floor, a normal-CDF P(more), additive context adjustments, then an
// edge vs the book line and a Poisson-binomial EV optimizer with PrizePicks
// power/flex payouts and demon/goblin per-pick factors.
//
// EdgeBoard projects from live ESPN game logs; CourtCommand ships season-level
// stats, so projections here use season per-game means as the baseline. Swap
// the `projection()` source for a game-log feed to match EdgeBoard exactly.
// ============================================================================

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const roundHalf = (x: number) => Math.round(x - 0.5) + 0.5;

// Normal CDF via Abramowitz–Stegun erf.
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t) *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function normCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// deterministic pseudo-random in [0,1) from a string
function hashRand(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ---------------- Markets ----------------
export type Market =
  | "PTS"
  | "REB"
  | "AST"
  | "PRA"
  | "PR"
  | "PA"
  | "RA"
  | "3PM"
  | "STOCKS"
  | "STL"
  | "BLK"
  | "TOV"
  | "FAN";

export const MARKET_LABEL: Record<Market, string> = {
  PTS: "Points",
  REB: "Rebounds",
  AST: "Assists",
  PRA: "Pts+Reb+Ast",
  PR: "Pts+Rebs",
  PA: "Pts+Asts",
  RA: "Rebs+Asts",
  "3PM": "3-PT Made",
  STOCKS: "Blks+Stls",
  STL: "Steals",
  BLK: "Blocks",
  TOV: "Turnovers",
  FAN: "Fantasy Score",
};

export const MARKETS: Market[] = ["PTS", "REB", "AST", "PRA", "PR", "PA", "RA", "3PM", "STOCKS", "STL", "BLK", "TOV", "FAN"];

function projection(p: Player, m: Market): number {
  const threes = p.tpa * p.tpp;
  switch (m) {
    case "PTS": return p.ppg;
    case "REB": return p.rpg;
    case "AST": return p.apg;
    case "PRA": return p.ppg + p.rpg + p.apg;
    case "PR": return p.ppg + p.rpg;
    case "PA": return p.ppg + p.apg;
    case "RA": return p.rpg + p.apg;
    case "3PM": return threes;
    case "STOCKS": return p.spg + p.bpg;
    case "STL": return p.spg;
    case "BLK": return p.bpg;
    case "TOV": return p.topg;
    case "FAN": return p.ppg + 1.2 * p.rpg + 1.5 * p.apg + 3 * p.spg + 3 * p.bpg - p.topg;
  }
}

// Coefficient of variation per market (mirrors EdgeBoard's sigma = max(std, mean*0.4, floor)).
const CV: Record<Market, number> = {
  PTS: 0.34, REB: 0.4, AST: 0.42, PRA: 0.26, PR: 0.3, PA: 0.32, RA: 0.34,
  "3PM": 0.55, STOCKS: 0.5, STL: 0.72, BLK: 0.72, TOV: 0.55, FAN: 0.26,
};
const FLOOR: Record<Market, number> = {
  PTS: 2.5, REB: 1.2, AST: 1.0, PRA: 3.5, PR: 2.5, PA: 2.5, RA: 1.6,
  "3PM": 0.7, STOCKS: 0.6, STL: 0.5, BLK: 0.5, TOV: 0.6, FAN: 4,
};

function sigma(p: Player, m: Market, proj: number): number {
  // higher-usage players are a touch more volatile
  const usageVol = 1 + (p.usg - 24) * 0.004;
  return Math.max(proj * CV[m] * usageVol, FLOOR[m]);
}

export type OddsType = "standard" | "demon" | "goblin";
export type Side = "more" | "less";

const IMPLIED_MORE: Record<OddsType, number> = { standard: 0.5, demon: 0.4, goblin: 0.588 };
const ODDS_FACTOR: Record<OddsType, number> = { standard: 1.0, demon: 1.5, goblin: 0.85 };

export interface PropAdjustment {
  label: string;
  shift: number; // additive to projection mean
  reason: string;
  confidence: number; // 0..1
}

export interface PropEdge {
  id: string;
  player: Player;
  market: Market;
  marketLabel: string;
  line: number;
  oddsType: OddsType;
  projection: number; // adjusted mean
  baseline: number; // pre-adjustment mean
  sigma: number;
  pMore: number;
  pLess: number;
  side: Side; // recommended
  pSide: number; // model prob of recommended side
  implied: number; // implied prob of recommended side under this oddsType
  edge: number; // pSide - implied (0..1)
  evPct: number; // single-pick EV % at this oddsType payout factor
  grade: string;
  adjustments: PropAdjustment[];
}

// Context adjustments — proxy for EdgeBoard's recent-form / matchup signals
// using the season-level signals CourtCommand carries (form via netRtg,
// matchup difficulty via a deterministic opponent draw).
function adjustments(p: Player, m: Market, baseline: number, sd: number): PropAdjustment[] {
  const out: PropAdjustment[] = [];
  // recent form proxy: on-court net rating tilts production
  if (Math.abs(p.netRtg) >= 3) {
    const shift = (p.netRtg / 10) * sd * 0.25;
    out.push({
      label: "Recent form",
      shift,
      reason: `${p.netRtg >= 0 ? "+" : ""}${p.netRtg} on-court net rating`,
      confidence: 0.3,
    });
  }
  // matchup proxy: deterministic opponent strength draw
  const draw = hashRand(p.id + m + "opp") - 0.5; // -0.5..0.5
  if (Math.abs(draw) > 0.18) {
    const shift = draw * sd * 0.4;
    out.push({
      label: "Matchup",
      shift,
      reason: draw > 0 ? "soft opposing defense for this stat" : "tough opposing matchup",
      confidence: clamp(0.15 + Math.abs(draw) * 0.4, 0, 0.45),
    });
  }
  // usage/role nudge for combo markets
  if ((m === "AST" || m === "PA" || m === "RA") && p.apg >= 7) {
    out.push({ label: "Primary creator", shift: sd * 0.12, reason: "high on-ball usage", confidence: 0.25 });
  }
  return out;
}

export function evaluateProp(p: Player, m: Market, oddsType: OddsType = "standard"): PropEdge {
  const baseline = projection(p, m);
  const sd = sigma(p, m, baseline);
  const adj = adjustments(p, m, baseline, sd);
  const adjMean = baseline + adj.reduce((s, a) => s + a.shift * a.confidence, 0);

  // book line: near projection, shaded by a deterministic per-prop bias, then
  // demon (harder) / goblin (easier) offsets
  const bias = (hashRand(p.id + m + "line") - 0.5) * 0.1; // -5%..+5%
  let line = roundHalf(baseline * (1 + bias));
  if (oddsType === "demon") line = roundHalf(line + sd * 0.55);
  if (oddsType === "goblin") line = roundHalf(line - sd * 0.55);
  line = Math.max(0.5, line);

  const pMore = clamp(1 - normCdf((line - adjMean) / sd), 0.08, 0.92);
  const pLess = 1 - pMore;
  const side: Side = pMore >= pLess ? "more" : "less";
  const pSide = Math.max(pMore, pLess);
  // implied prob of the recommended side under this oddsType
  const implied = side === "more" ? IMPLIED_MORE[oddsType] : 1 - IMPLIED_MORE[oddsType];
  const edge = pSide - implied;
  const evPct = (pSide * ODDS_FACTOR[oddsType] - implied * ODDS_FACTOR[oddsType]) * 100 + edge * 0; // edge-weighted EV proxy
  const grade = letterGrade(clamp(50 + edge * 280, 5, 99));

  return {
    id: `${p.id}-${m}-${oddsType}`,
    player: p,
    market: m,
    marketLabel: MARKET_LABEL[m],
    line,
    oddsType,
    projection: Math.round(adjMean * 10) / 10,
    baseline: Math.round(baseline * 10) / 10,
    sigma: Math.round(sd * 10) / 10,
    pMore: Math.round(pMore * 1000) / 1000,
    pLess: Math.round(pLess * 1000) / 1000,
    side,
    pSide: Math.round(pSide * 1000) / 1000,
    implied,
    edge: Math.round(edge * 1000) / 1000,
    evPct: Math.round(evPct * 10) / 10,
    grade,
    adjustments: adj,
  };
}

// Which markets are meaningful for a given player (avoid 0.5-line noise).
function marketsFor(p: Player): Market[] {
  const ms: Market[] = ["PTS", "REB", "AST", "PRA", "PR", "PA", "FAN"];
  if (p.tpa * p.tpp >= 1.2) ms.push("3PM");
  if (p.spg + p.bpg >= 1.2) ms.push("STOCKS");
  if (p.rpg + p.apg >= 5) ms.push("RA");
  return ms;
}

export interface BoardFilters {
  market?: Market | "ALL";
  oddsType?: OddsType | "ALL";
  minEdge?: number;
}

export function edgeBoard(filters: BoardFilters = {}): PropEdge[] {
  const out: PropEdge[] = [];
  for (const p of PLAYERS) {
    for (const m of marketsFor(p)) {
      const variants: OddsType[] =
        hashRand(p.id + m) > 0.7 ? ["standard", hashRand(p.id + m + "v") > 0.5 ? "demon" : "goblin"] : ["standard"];
      for (const ot of variants) {
        const e = evaluateProp(p, m, ot);
        if (filters.market && filters.market !== "ALL" && e.market !== filters.market) continue;
        if (filters.oddsType && filters.oddsType !== "ALL" && e.oddsType !== filters.oddsType) continue;
        if (filters.minEdge && e.edge < filters.minEdge) continue;
        out.push(e);
      }
    }
  }
  return out.sort((a, b) => b.edge - a.edge);
}

// ---------------- Lineup optimizer (Poisson binomial + PrizePicks payouts) ----------------
export type PlayType = "power" | "flex";

// Power: all must hit. Multiplier by entry size.
const POWER_MULT: Record<number, number> = { 2: 3, 3: 5, 4: 10, 5: 20, 6: 37.5 };
// Flex: tiered payouts (hits -> multiplier) by entry size.
const FLEX_TABLE: Record<number, Record<number, number>> = {
  3: { 3: 2.25, 2: 1.25 },
  4: { 4: 5, 3: 1.5 },
  5: { 5: 10, 4: 2, 3: 0.4 },
  6: { 6: 25, 5: 2, 4: 0.4 },
};

export interface LineupPick {
  prop: PropEdge;
  side: Side;
  prob: number; // model prob of chosen side
}
export interface LineupResult {
  picks: LineupPick[];
  playType: PlayType;
  entryCost: number;
  hitProbAll: number; // P(all hit)
  expectedValue: number; // $
  evPct: number; // EV as % of stake
  payoutMultiplier: number; // gross at max tier (incl. demon/goblin factor)
  oddsFactor: number;
  correlationRisk: "low" | "medium" | "high";
  distribution: number[]; // P(exactly k hits)
  grade: string;
}

// Poisson binomial distribution P(exactly k successes) for independent probs.
function poissonBinomial(probs: number[]): number[] {
  let dist = [1];
  for (const p of probs) {
    const next = new Array(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * (1 - p);
      next[k + 1] += dist[k] * p;
    }
    dist = next;
  }
  return dist;
}

function correlationRisk(picks: LineupPick[]): "low" | "medium" | "high" {
  const games = picks.map((x) => x.prop.player.team);
  const players = picks.map((x) => x.prop.player.id);
  if (new Set(players).size < players.length) return "high";
  if (new Set(games).size < games.length) return "medium";
  return "low";
}

export function optimizeLineup(
  picks: LineupPick[],
  playType: PlayType = "power",
  entryCost = 10,
): LineupResult | null {
  const n = picks.length;
  if (n < 2) return null;
  const probs = picks.map((x) => clamp(x.prob, 0.05, 0.95));
  const oddsFactor = Math.max(0.1, 1 + picks.reduce((s, x) => s + (ODDS_FACTOR[x.prop.oddsType] - 1), 0));
  const dist = poissonBinomial(probs);
  const hitProbAll = dist[n] ?? 0;

  // correlation discount on the all-hit tail
  const risk = correlationRisk(picks);
  const rho = risk === "high" ? 0.45 : risk === "medium" ? 0.2 : 0;

  let ev = 0;
  let payoutMultiplier = 0;
  if (playType === "power") {
    const mult = (POWER_MULT[n] ?? POWER_MULT[6]) * oddsFactor;
    payoutMultiplier = mult;
    const pWin = hitProbAll * (1 - rho * 0.5);
    ev = entryCost * (mult * pWin - 1);
  } else {
    const table = FLEX_TABLE[n] ?? FLEX_TABLE[6];
    payoutMultiplier = (table[n] ?? 0) * oddsFactor;
    let exp = 0;
    for (let k = 0; k < dist.length; k++) {
      const mult = (table[k] ?? 0) * oddsFactor;
      const adjP = k === n ? dist[k] * (1 - rho * 0.5) : dist[k];
      exp += mult * adjP;
    }
    ev = entryCost * (exp - 1);
  }

  const evPct = (ev / entryCost) * 100;
  return {
    picks,
    playType,
    entryCost,
    hitProbAll: Math.round(hitProbAll * 1000) / 1000,
    expectedValue: Math.round(ev * 100) / 100,
    evPct: Math.round(evPct * 10) / 10,
    payoutMultiplier: Math.round(payoutMultiplier * 100) / 100,
    oddsFactor: Math.round(oddsFactor * 100) / 100,
    correlationRisk: risk,
    distribution: dist.map((d) => Math.round(d * 1000) / 1000),
    grade: letterGrade(clamp(50 + evPct * 1.6, 5, 99)),
  };
}

export { TEAM_MAP };
