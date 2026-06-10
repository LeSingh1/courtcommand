// Full playoff play-by-play (89 games, ~43k events) — every free throw,
// turnover, and field goal with the real running score. This drives the
// event-driven win-probability curve: a made-FG-only curve misses the
// free-throw endgames that decide close playoff games.
import { TEAM_MAP } from "@/lib/data";
import { predictWinProb } from "@/lib/model";

export interface PbpEvent {
  p: number; // period
  c: number; // clock seconds remaining in period
  h: number; // home score after the play
  a: number; // away score after the play
  t: 1 | 0 | -1; // acting side: 1 home, 0 away, -1 neutral
  k: "s" | "f" | "o" | "e"; // field goal / free throw / turnover / other
  v: number; // score value of the play
}
export interface PbpGame {
  gameId: string;
  home: string;
  away: string;
  events: PbpEvent[];
}

let _cache: PbpGame[] | null = null;
let _promise: Promise<PbpGame[]> | null = null;

export function loadPbp(): Promise<PbpGame[]> {
  if (_cache) return Promise.resolve(_cache);
  if (!_promise) {
    _promise = fetch("/pbp.playoffs.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: PbpGame[]) => {
        _cache = Array.isArray(d) ? d : [];
        return _cache;
      })
      .catch(() => {
        _cache = [];
        return _cache;
      });
  }
  return _promise;
}

// Seconds of game time remaining at an event (12-min quarters; in OT only the
// period clock remains — matches how the WP model was trained).
export function secondsLeftAt(period: number, clockSec: number): number {
  if (period <= 4) return Math.max(0, (4 - period) * 720 + clockSec);
  return Math.max(0, clockSec);
}

function netRating(abbr: string): number {
  const t = TEAM_MAP[abbr];
  return t ? t.ortg - t.drtg : 0;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface WpPoint {
  i: number;
  wp: number; // home win prob, 0-100
  margin: number;
  period: number;
  clockSec: number;
  kind: PbpEvent["k"];
}
export interface WpSwing {
  index: number;
  delta: number; // signed WP change, percentage points
  label: string;
}
export interface GameWpSeries {
  teams: [string, string]; // [home, away]
  points: WpPoint[];
  swings: WpSwing[]; // top-3 |ΔWP| events
  turningPoint: WpSwing | null; // last crossing of the 50% line
  excitement: number; // Σ|ΔWP| across the game, in WP points
  finalMargin: number;
  homeWon: boolean;
}

const KIND_LABEL: Record<PbpEvent["k"], string> = {
  s: "field goal",
  f: "free throw",
  o: "turnover",
  e: "play",
};

function fmtClock(c: number): string {
  return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, "0")}`;
}

// Event-driven WP: one point per state change (score, clock, or possession),
// real margins including free throws, possession approximated as flipping to
// the other side after a score or turnover.
export function gameWpSeries(game: PbpGame): GameWpSeries {
  const homeStrength = clamp(netRating(game.home) - netRating(game.away), -10, 10);
  const points: WpPoint[] = [];
  let prevKey = "";
  let homeHasBall = true; // jump ball approximation
  for (const e of game.events) {
    if (e.t !== -1 && (e.k === "s" || e.k === "f" || e.k === "o")) {
      // ball goes to the other side after a score or turnover
      homeHasBall = e.t === 0;
    }
    const key = `${e.p}:${e.c}:${e.h}:${e.a}`;
    if (key === prevKey && e.k === "e") continue; // skip no-state-change noise
    prevKey = key;
    const wp = predictWinProb({
      margin: e.h - e.a,
      secondsLeft: secondsLeftAt(e.p, e.c),
      homeHasBall,
      homeStrength,
    });
    points.push({
      i: points.length,
      wp: Math.round(clamp(wp, 0.005, 0.995) * 1000) / 10,
      margin: e.h - e.a,
      period: e.p,
      clockSec: e.c,
      kind: e.k,
    });
  }

  // swings + turning point + excitement from consecutive deltas
  const deltas: WpSwing[] = [];
  let excitement = 0;
  let turningPoint: WpSwing | null = null;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].wp - points[i - 1].wp;
    excitement += Math.abs(d);
    const pt = points[i];
    const swing: WpSwing = {
      index: i,
      delta: Math.round(d * 10) / 10,
      label: `Q${pt.period > 4 ? `OT${pt.period - 4}` : pt.period} ${fmtClock(pt.clockSec)} · ${KIND_LABEL[pt.kind]} → ${pt.margin >= 0 ? game.home : game.away} ${Math.abs(pt.margin)} up`,
    };
    if (Math.abs(d) > 0.05) deltas.push(swing);
    if ((points[i - 1].wp - 50) * (pt.wp - 50) < 0) turningPoint = swing;
  }
  const swings = [...deltas].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 3);
  const last = points.at(-1);
  return {
    teams: [game.home, game.away],
    points,
    swings,
    turningPoint,
    excitement: Math.round(excitement),
    finalMargin: last ? last.margin : 0,
    homeWon: (last?.margin ?? 0) > 0,
  };
}

// ---- Calibration: Brier score by game phase, across all 89 games ----------
// For every event we ask the model for home WP and score it against the real
// final outcome. Brier = mean (p − outcome)²; 0.25 = always saying 50/50.
// Reported by time bucket so you can see exactly where the model is sharp
// (early game) and where late-game state it doesn't see (fouling, timeouts)
// costs it.
export interface BrierBucket {
  label: string;
  brier: number;
  n: number;
}

const BUCKETS: { label: string; test: (secLeft: number, period: number) => boolean }[] = [
  { label: "Q1", test: (s, p) => p === 1 },
  { label: "Q2", test: (s, p) => p === 2 },
  { label: "Q3", test: (s, p) => p === 3 },
  { label: "Q4 early", test: (s, p) => p === 4 && s > 300 },
  { label: "Last 5:00", test: (s, p) => p === 4 && s <= 300 },
  { label: "Overtime", test: (s, p) => p > 4 },
];

export function wpCalibration(games: PbpGame[]): BrierBucket[] {
  const sums = BUCKETS.map(() => ({ se: 0, n: 0 }));
  for (const g of games) {
    const series = gameWpSeries(g);
    const outcome = series.homeWon ? 1 : 0;
    for (const pt of series.points) {
      const sl = secondsLeftAt(pt.period, pt.clockSec);
      const bi = BUCKETS.findIndex((b) => b.test(sl, pt.period));
      if (bi === -1) continue;
      const p = pt.wp / 100;
      sums[bi].se += (p - outcome) ** 2;
      sums[bi].n += 1;
    }
  }
  return BUCKETS.map((b, i) => ({
    label: b.label,
    brier: sums[i].n ? Math.round((sums[i].se / sums[i].n) * 1000) / 1000 : 0,
    n: sums[i].n,
  }));
}
