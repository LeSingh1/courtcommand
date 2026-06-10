// Real NBA playoff shots — every shooting play by every player across all 2026
// postseason games (ESPN play-by-play). The full set is ~15k shots / ~5 MB, so
// it's served statically from /public and fetched at runtime rather than
// bundled into the page.
import { ebShrink } from "@/lib/engine/stats";

export interface RealShot {
  id: string;
  espnId: number;
  player: string;
  team: string;
  gameId: string;
  game: string;
  date: string;
  period: number;
  clock: string;
  dist: number;
  value: number;
  made: boolean;
  assisted: boolean;
  shotType: string; // model ShotType
  typeText: string; // ESPN type (e.g. "Pullup Jump Shot")
  text: string; // full play description
  x: number; // CourtChart coords
  y: number;
}

export interface ShotPlayer {
  espnId: number;
  player: string;
  team: string;
  count: number;
}

let _cache: RealShot[] | null = null;
let _promise: Promise<RealShot[]> | null = null;

// Fetch the full playoff shot set once, then serve from cache.
export function loadRealShots(): Promise<RealShot[]> {
  if (_cache) return Promise.resolve(_cache);
  if (!_promise) {
    _promise = fetch("/shots.playoffs.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: RealShot[]) => {
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

export function shotPlayers(shots: RealShot[]): ShotPlayer[] {
  const m = new Map<number, ShotPlayer>();
  for (const s of shots) {
    const e = m.get(s.espnId);
    if (e) e.count++;
    else m.set(s.espnId, { espnId: s.espnId, player: s.player, team: s.team, count: 1 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export function shotsForPlayer(shots: RealShot[], espnId: number): RealShot[] {
  return shots
    .filter((s) => s.espnId === espnId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.period - b.period);
}

// ---- Real clutch-time shooting, derived from the playoff shots ----
// Clutch = last 5:00 of Q4 or any overtime. Every number below is real:
// counted directly from the 2026 playoff play-by-play.
function clockToSec(clock: string): number {
  const m = (clock || "").match(/(\d+):(\d+)/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 999;
}

export interface ClutchLeader {
  espnId: number;
  player: string;
  team: string;
  att: number;
  made: number;
  fgPct: number;
  threeAtt: number;
  threeMade: number;
  threePct: number;
  pts: number;
  efg: number;
  smallSample: boolean; // fewer than 10 attempts under this definition
}

// Configurable clutch definition. The window applies to the end of Q4 and the
// end of each overtime period (OT periods are 5:00 long, so the default
// 5-minute window covers all of OT — identical to the original definition).
export interface ClutchOptions {
  lastMinutes?: number; // final-period window in minutes (default 5)
  includeOT?: boolean; // count overtime shots (default true)
  otOnly?: boolean; // only overtime shots, any clock
}

export function isClutchShot(s: RealShot, opts: ClutchOptions = {}): boolean {
  const { lastMinutes = 5, includeOT = true, otOnly = false } = opts;
  if (otOnly) return s.period >= 5;
  if (s.period < 4) return false;
  if (s.period >= 5 && !includeOT) return false;
  return clockToSec(s.clock) <= lastMinutes * 60;
}

export function isClutch(s: RealShot): boolean {
  return isClutchShot(s);
}

// ---- Real game momentum, reconstructed from the playoff shot sequence ----
// Running margin is field-goals only (free throws aren't in public play-by-play
// shot data), but the scoring RUNS below are real and counted directly.
export interface GameInfo {
  gameId: string;
  game: string;
  date: string;
  shots: number;
}

export function playoffGames(shots: RealShot[]): GameInfo[] {
  const m = new Map<string, GameInfo>();
  for (const s of shots) {
    let e = m.get(s.gameId);
    if (!e) {
      e = { gameId: s.gameId, game: s.game, date: s.date, shots: 0 };
      m.set(s.gameId, e);
    }
    e.shots++;
  }
  return [...m.values()].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.shots - a.shots);
}

export interface MomentumPoint {
  i: number;
  margin: number; // teamA - teamB cumulative (FG only)
  team: string;
  pts: number;
  period: number;
  clock: string;
}
export interface ScoringRun {
  team: string;
  pts: number;
  startIdx: number;
  endIdx: number;
  period: number;
  clock: string;
}

// Timeout-proxy analysis: after every 8-0+ run, how did the team that
// conceded it shoot on its next (up to) five field-goal attempts, vs its own
// FG% on every attempt up to the end of the run? FG attempts only — free
// throws aren't in public shot data.
export interface RunResponse {
  team: string; // team that conceded the run
  made: number;
  att: number; // up to 5 attempts after the run
  fgPct: number;
  baselinePct: number; // their FG% on all attempts up to the run's last make
  improved: boolean; // fgPct > baselinePct
}
export interface KeyShiftEvent {
  run: ScoringRun;
  response: RunResponse | null; // null when no attempts remained
  label: string;
}

export function gameMomentum(
  shots: RealShot[],
  gameId: string,
): {
  teams: string[];
  timeline: MomentumPoint[];
  runs: ScoringRun[];
  biggest: ScoringRun | null;
  keyShiftEvents: KeyShiftEvent[];
} {
  const inGame = shots.filter((s) => s.gameId === gameId);
  const teams = [...new Set(inGame.map((s) => s.team))].filter(Boolean).slice(0, 2);
  const [A] = teams;
  const made = inGame
    .filter((s) => s.made)
    .sort((a, b) => a.period - b.period || clockToSec(b.clock) - clockToSec(a.clock));
  let scoreA = 0;
  let scoreB = 0;
  const timeline: MomentumPoint[] = [];
  for (let i = 0; i < made.length; i++) {
    const s = made[i];
    if (s.team === A) scoreA += s.value;
    else scoreB += s.value;
    timeline.push({ i, margin: scoreA - scoreB, team: s.team, pts: s.value, period: s.period, clock: s.clock });
  }
  // runs: a team scoring >=6 straight points before the other team scores
  const runs: ScoringRun[] = [];
  let curTeam = made[0]?.team ?? "";
  let curPts = 0;
  let start = 0;
  const flush = (end: number) => {
    if (curPts >= 6 && curTeam) {
      const s = made[start];
      runs.push({ team: curTeam, pts: curPts, startIdx: start, endIdx: end, period: s?.period ?? 1, clock: s?.clock ?? "" });
    }
  };
  for (let i = 0; i < made.length; i++) {
    if (made[i].team === curTeam) curPts += made[i].value;
    else {
      flush(i - 1);
      curTeam = made[i].team;
      curPts = made[i].value;
      start = i;
    }
  }
  flush(made.length - 1);

  // Post-run response for every 8-0+ run, in chronological order (runs are
  // built chronologically; capture them before the points sort below).
  const ordered = inGame
    .slice()
    .sort((a, b) => a.period - b.period || clockToSec(b.clock) - clockToSec(a.clock));
  const keyShiftEvents: KeyShiftEvent[] = [];
  for (const run of runs) {
    if (run.pts < 8) continue;
    const other = teams.find((t) => t && t !== run.team) ?? "";
    const endShot = made[run.endIdx];
    const endPos = endShot ? ordered.findIndex((s) => s.id === endShot.id) : -1;
    if (!other || endPos < 0) continue;
    let bAtt = 0;
    let bMade = 0;
    for (let i = 0; i <= endPos; i++) {
      if (ordered[i].team !== other) continue;
      bAtt++;
      if (ordered[i].made) bMade++;
    }
    const next = ordered
      .slice(endPos + 1)
      .filter((s) => s.team === other)
      .slice(0, 5);
    const rMade = next.filter((s) => s.made).length;
    const baselinePct = bAtt ? bMade / bAtt : 0;
    const fgPct = next.length ? rMade / next.length : 0;
    const response: RunResponse | null = next.length
      ? { team: other, made: rMade, att: next.length, fgPct, baselinePct, improved: fgPct > baselinePct }
      : null;
    const pct = Math.round(fgPct * 100);
    const base = Math.round(baselinePct * 100);
    const label = response
      ? `${other} went ${rMade}/${next.length} (${pct}%) on its next shots after ${run.team}'s ${run.pts}-0 run, ${
          fgPct > baselinePct ? `up from ${base}% before` : fgPct < baselinePct ? `down from ${base}% before` : `level with ${base}% before`
        }`
      : `${run.team}'s ${run.pts}-0 run ended the game; ${other} took no more shots`;
    keyShiftEvents.push({ run: { ...run }, response, label });
  }

  runs.sort((a, b) => b.pts - a.pts);
  return { teams, timeline, runs, biggest: runs[0] ?? null, keyShiftEvents };
}

// ---- Real highlight detection from the playoff shots ----
// Scores each made shot for "highlight-worthiness" from the real play text +
// context (dunks, deep threes, clutch makes, putbacks). Real events, real
// confidence — no fabricated detections.
export interface HighlightClip {
  shot: RealShot;
  score: number;
  tags: string[];
  rank: number; // 1-based position in the full reel
  clipStart: string; // proxy window from the play clock, e.g. "Q4 2:04"
  clipEnd: string; // e.g. "Q4 1:56"
}

// Clip windows are honest proxies: ±4s of game clock around the recorded play
// time (clamped to the period), not real video timestamps.
const CLIP_PAD_SEC = 4;

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

function clipWindow(s: RealShot): { start: string; end: string } {
  const len = s.period >= 5 ? 300 : 720; // OT periods run 5:00, regulation 12:00
  const t = Math.min(len, Math.max(0, clockToSec(s.clock)));
  const q = s.period >= 5 ? (s.period > 5 ? `OT${s.period - 4}` : "OT") : `Q${s.period}`;
  return {
    start: `${q} ${fmtClock(Math.min(len, t + CLIP_PAD_SEC))}`,
    end: `${q} ${fmtClock(Math.max(0, t - CLIP_PAD_SEC))}`,
  };
}

function highlightScore(s: RealShot): { score: number; tags: string[] } {
  if (!s.made) return { score: 0, tags: [] };
  const t = (s.text || "").toLowerCase();
  const tags: string[] = [];
  let sc = 18;
  if (/dunk|alley/.test(t)) {
    sc += 44;
    tags.push("Dunk");
  }
  if (/reverse|360|windmill|poster|put ?back|tip/.test(t)) {
    sc += 16;
    tags.push("Above the rim");
  }
  if (s.value === 3 && s.dist >= 27) {
    sc += 32;
    tags.push("Deep three");
  } else if (s.value === 3) {
    sc += 12;
    tags.push("Three");
  }
  if (isClutch(s)) {
    sc += 30;
    tags.push("Clutch");
  }
  if (/step ?back|fadeaway|turnaround|fade/.test(t)) {
    sc += 12;
    tags.push("Tough shot");
  }
  return { score: Math.min(99, sc), tags };
}

export function highlightReel(shots: RealShot[], n = 28): HighlightClip[] {
  return shots
    .filter((s) => s.made)
    .map((s) => ({ shot: s, ...highlightScore(s) }))
    .filter((h) => h.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((h, i) => {
      const w = clipWindow(h.shot);
      return { ...h, rank: i + 1, clipStart: w.start, clipEnd: w.end };
    });
}

// Per-tag filter for the reel. Ranks are preserved from the full reel so a
// filtered view still shows each clip's true overall rank.
export function filterReelByTag(reel: HighlightClip[], tag: string | null): HighlightClip[] {
  return tag ? reel.filter((h) => h.tags.includes(tag)) : reel;
}

// ---- Real per-game form / narrative momentum from the playoff shots ----
// Replaces fabricated "media sentiment" with a momentum signal built from a
// player's actual game-by-game playoff production. Every number is counted
// directly from the play-by-play; nothing here is randomly generated.
export interface FormGame {
  gameId: string;
  game: string;
  opp: string;
  date: string;
  pts: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  efg: number;
  score: number; // -100..100 vs the player's own playoff baseline
}
export interface FormShift {
  fromGame: FormGame;
  toGame: FormGame;
  delta: number; // toGame.score - fromGame.score
}
export interface PlayerForm {
  games: FormGame[];
  current: number;
  trend: "rising" | "cooling" | "steady";
  avgPts: number;
  peak: FormGame | null;
  headlines: { text: string; tone: number }[];
  biggestPositiveShift: FormShift | null; // largest game-over-game score jump
  biggestNegativeShift: FormShift | null; // largest game-over-game score drop
}

export function playerForm(shots: RealShot[], espnId: number): PlayerForm | null {
  const mine = shots.filter((s) => s.espnId === espnId);
  if (mine.length < 6) return null;
  const team = mine[0].team;
  const byGame = new Map<string, FormGame>();
  for (const s of mine) {
    let g = byGame.get(s.gameId);
    if (!g) {
      const opp =
        (s.game || "")
          .split(/\s+vs\s+|\s+@\s+/)
          .map((t) => t.trim())
          .find((t) => t && t !== team) || "";
      g = { gameId: s.gameId, game: s.game, opp, date: s.date, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, efg: 0, score: 0 };
      byGame.set(s.gameId, g);
    }
    g.fga++;
    if (s.value === 3) g.fg3a++;
    if (s.made) {
      g.fgm++;
      g.pts += s.value;
      if (s.value === 3) g.fg3m++;
    }
  }
  const games = [...byGame.values()].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  for (const g of games) g.efg = g.fga ? (g.fgm + 0.5 * g.fg3m) / g.fga : 0;
  // Baseline = the player's own playoff mean/std of points (field-goal points).
  const pts = games.map((g) => g.pts);
  const mean = pts.reduce((a, b) => a + b, 0) / pts.length;
  const std = Math.sqrt(pts.reduce((a, b) => a + (b - mean) ** 2, 0) / pts.length) || 1;
  const meanEfg = games.reduce((a, g) => a + g.efg, 0) / games.length;
  for (const g of games) {
    const zPts = (g.pts - mean) / std;
    g.score = Math.round(Math.max(-100, Math.min(100, zPts * 34 + (g.efg - meanEfg) * 110)));
  }
  const current = games.at(-1)?.score ?? 0;
  const prior = games.length >= 3 ? ((games.at(-2)?.score ?? 0) + (games.at(-3)?.score ?? 0)) / 2 : games[0].score;
  const trend = current - prior > 12 ? "rising" : current - prior < -12 ? "cooling" : "steady";
  const peak = [...games].sort((a, b) => b.pts - a.pts)[0] ?? null;
  // Largest game-over-game momentum swings (consecutive games, chronological).
  let biggestPositiveShift: FormShift | null = null;
  let biggestNegativeShift: FormShift | null = null;
  for (let i = 1; i < games.length; i++) {
    const delta = games[i].score - games[i - 1].score;
    if (delta > 0 && (!biggestPositiveShift || delta > biggestPositiveShift.delta))
      biggestPositiveShift = { fromGame: games[i - 1], toGame: games[i], delta };
    if (delta < 0 && (!biggestNegativeShift || delta < biggestNegativeShift.delta))
      biggestNegativeShift = { fromGame: games[i - 1], toGame: games[i], delta };
  }
  const headlines = [...games]
    .slice(-4)
    .reverse()
    .map((g) => ({
      text: `vs ${g.opp || "opp"} — ${g.pts} pts on ${g.fgm}/${g.fga} FG${g.fg3a ? `, ${g.fg3m}/${g.fg3a} 3PT` : ""}`,
      tone: g.score,
    }));
  return {
    games,
    current,
    trend,
    avgPts: Math.round(mean * 10) / 10,
    peak,
    headlines,
    biggestPositiveShift,
    biggestNegativeShift,
  };
}

// Players who actually appear in the playoff shot set (for restricting pickers).
export function shotPlayerIds(shots: RealShot[], minShots = 6): Set<number> {
  const m = new Map<number, number>();
  for (const s of shots) m.set(s.espnId, (m.get(s.espnId) ?? 0) + 1);
  return new Set([...m.entries()].filter(([, c]) => c >= minShots).map(([id]) => id));
}

// ---- Real per-player shot chart from the playoff shots ----
// Plots a player's actual playoff attempts (real court coordinates + outcomes)
// and buckets them into floor zones for a real eFG% heatmap. Replaces the old
// synthetic per-player shot generator.
const SHOT_ZONES: { id: string; label: string; cx: number; cy: number }[] = [
  { id: "rim", label: "Restricted", cx: 250, cy: 80 },
  { id: "paint", label: "Paint", cx: 250, cy: 150 },
  { id: "ml", label: "L Mid", cx: 130, cy: 150 },
  { id: "mr", label: "R Mid", cx: 370, cy: 150 },
  { id: "elL", label: "L Elbow", cx: 175, cy: 215 },
  { id: "elR", label: "R Elbow", cx: 325, cy: 215 },
  { id: "c3l", label: "L Corner 3", cx: 50, cy: 90 },
  { id: "c3r", label: "R Corner 3", cx: 450, cy: 90 },
  { id: "w3l", label: "L Wing 3", cx: 90, cy: 240 },
  { id: "w3r", label: "R Wing 3", cx: 410, cy: 240 },
  { id: "top3", label: "Top 3", cx: 250, cy: 320 },
];

export interface ChartDot {
  x: number;
  y: number;
  made: boolean;
  r: number;
}
export interface ChartZone {
  id: string;
  label: string;
  cx: number;
  cy: number;
  efg: number; // EB-shrunk toward the pool's zone baseline (the honest display value)
  efgRaw?: number; // unshrunk observed rate
  poolEfg?: number; // league baseline for this zone from the same pool
  freq: number;
  att: number;
}
// Shot-diet summary: where a player's attempts come from, vs the playoff-wide
// split computed from the same shot set (same quarter filter applied). Rim is
// inside 8 ft; mid is any non-three from 8 ft out.
export interface ShotDiet {
  rim: number; // share of attempts, 0..1
  mid: number;
  three: number;
  leagueRim: number;
  leagueMid: number;
  leagueThree: number;
  note: string; // league-relative summary
}

function dietSplit(list: RealShot[]): { rim: number; mid: number; three: number } {
  let rim = 0;
  let mid = 0;
  let three = 0;
  for (const s of list) {
    if (s.value === 3) three++;
    else if (s.dist < 8) rim++;
    else mid++;
  }
  const t = list.length || 1;
  return { rim: rim / t, mid: mid / t, three: three / t };
}

export function shotDietSummary(mine: RealShot[], pool: RealShot[]): ShotDiet {
  const p = dietSplit(mine);
  const lg = dietSplit(pool);
  const dims: { k: "rim" | "mid" | "three"; pv: number; lv: number; word: string }[] = [
    { k: "rim", pv: p.rim, lv: lg.rim, word: "at the rim" },
    { k: "mid", pv: p.mid, lv: lg.mid, word: "from midrange" },
    { k: "three", pv: p.three, lv: lg.three, word: "from three" },
  ];
  dims.sort((a, b) => Math.abs(b.pv - b.lv) - Math.abs(a.pv - a.lv));
  const top = dims[0];
  const pct = (v: number) => Math.round(v * 100);
  const diff = top.pv - top.lv;
  const note =
    Math.abs(diff) < 0.05
      ? `Mix is in line with the playoff field (${pct(lg.rim)}% rim / ${pct(lg.mid)}% mid / ${pct(lg.three)}% three league-wide).`
      : `${diff > 0 ? "Heavier" : "Lighter"} ${top.word} than the playoff field: ${pct(top.pv)}% of attempts vs ${pct(top.lv)}% league-wide.`;
  return { rim: p.rim, mid: p.mid, three: p.three, leagueRim: lg.rim, leagueMid: lg.mid, leagueThree: lg.three, note };
}

export interface RealChart {
  shots: ChartDot[];
  zones: ChartZone[];
  total: number;
  made: number;
  diet: ShotDiet;
}

// opts.period filters to a single quarter (1-4); period 5 means "any OT".
export function realShotChart(
  shots: RealShot[],
  espnId: number,
  opts: { period?: number } = {},
): RealChart | null {
  const base = shots.filter((s) => s.espnId === espnId);
  if (base.length < 8) return null;
  const inPeriod = (s: RealShot) =>
    opts.period == null ? true : opts.period >= 5 ? s.period >= 5 : s.period === opts.period;
  const mine = base.filter(inPeriod);
  if (!mine.length) return null;
  const pool = opts.period == null ? shots : shots.filter(inPeriod);
  const dots: ChartDot[] = mine.map((s) => ({ x: s.x, y: s.y, made: s.made, r: 3.4 }));

  const zoneFor = (s: RealShot): string => {
    let bestId = SHOT_ZONES[0].id;
    let bestD = Infinity;
    for (const z of SHOT_ZONES) {
      const d = (s.x - z.cx) ** 2 + (s.y - z.cy) ** 2;
      if (d < bestD) {
        bestD = d;
        bestId = z.id;
      }
    }
    return bestId;
  };
  const aggregate = (list: RealShot[]) => {
    const m = new Map<string, { att: number; made: number; made3: number }>();
    for (const s of list) {
      const id = zoneFor(s);
      let a = m.get(id);
      if (!a) {
        a = { att: 0, made: 0, made3: 0 };
        m.set(id, a);
      }
      a.att++;
      if (s.made) {
        a.made++;
        if (s.value === 3) a.made3++;
      }
    }
    return m;
  };
  const agg = aggregate(mine);
  const poolAgg = aggregate(pool);

  const total = mine.length;
  const made = mine.filter((s) => s.made).length;
  const zones: ChartZone[] = SHOT_ZONES.map((z) => {
    const a = agg.get(z.id);
    const att = a?.att ?? 0;
    const efgRaw = att ? (a!.made + 0.5 * a!.made3) / att : 0;
    // League baseline for THIS zone, from the same shot pool — then shrink the
    // player's raw rate toward it (10-attempt prior weight) so a 2-for-3 corner
    // can't blaze red on three attempts.
    const pz = poolAgg.get(z.id);
    const poolEfg = pz && pz.att ? (pz.made + 0.5 * pz.made3) / pz.att : 0.5;
    const efg = att ? ebShrink(efgRaw, att, poolEfg, 10) : 0;
    return { id: z.id, label: z.label, cx: z.cx, cy: z.cy, efg, efgRaw, poolEfg, freq: total ? att / total : 0, att };
  });
  return { shots: dots, zones, total, made, diet: shotDietSummary(mine, pool) };
}

export function clutchLeaders(shots: RealShot[], minAtt = 6, opts: ClutchOptions = {}): ClutchLeader[] {
  const m = new Map<number, ClutchLeader>();
  for (const s of shots) {
    if (!isClutchShot(s, opts)) continue;
    let e = m.get(s.espnId);
    if (!e) {
      e = { espnId: s.espnId, player: s.player, team: s.team, att: 0, made: 0, fgPct: 0, threeAtt: 0, threeMade: 0, threePct: 0, pts: 0, efg: 0, smallSample: false };
      m.set(s.espnId, e);
    }
    e.att++;
    if (s.made) {
      e.made++;
      e.pts += s.value;
    }
    if (s.value === 3) {
      e.threeAtt++;
      if (s.made) e.threeMade++;
    }
  }
  return [...m.values()]
    .filter((e) => e.att >= minAtt)
    .map((e) => ({
      ...e,
      fgPct: e.att ? e.made / e.att : 0,
      threePct: e.threeAtt ? e.threeMade / e.threeAtt : 0,
      efg: e.att ? (e.made + 0.5 * e.threeMade) / e.att : 0,
      smallSample: e.att < 10,
    }))
    .sort((a, b) => b.pts - a.pts);
}
