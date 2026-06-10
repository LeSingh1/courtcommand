// Real NBA playoff shots — every shooting play by every player across all 2026
// postseason games (ESPN play-by-play). The full set is ~15k shots / ~5 MB, so
// it's served statically from /public and fetched at runtime rather than
// bundled into the page.
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
}

export function isClutch(s: RealShot): boolean {
  return s.period >= 4 && clockToSec(s.clock) <= 300;
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

export function gameMomentum(
  shots: RealShot[],
  gameId: string,
): { teams: string[]; timeline: MomentumPoint[]; runs: ScoringRun[]; biggest: ScoringRun | null } {
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
  runs.sort((a, b) => b.pts - a.pts);
  return { teams, timeline, runs, biggest: runs[0] ?? null };
}

// ---- Real highlight detection from the playoff shots ----
// Scores each made shot for "highlight-worthiness" from the real play text +
// context (dunks, deep threes, clutch makes, putbacks). Real events, real
// confidence — no fabricated detections.
export interface HighlightClip {
  shot: RealShot;
  score: number;
  tags: string[];
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
    .slice(0, n);
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
export interface PlayerForm {
  games: FormGame[];
  current: number;
  trend: "rising" | "cooling" | "steady";
  avgPts: number;
  peak: FormGame | null;
  headlines: { text: string; tone: number }[];
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
  const headlines = [...games]
    .slice(-4)
    .reverse()
    .map((g) => ({
      text: `vs ${g.opp || "opp"} — ${g.pts} pts on ${g.fgm}/${g.fga} FG${g.fg3a ? `, ${g.fg3m}/${g.fg3a} 3PT` : ""}`,
      tone: g.score,
    }));
  return { games, current, trend, avgPts: Math.round(mean * 10) / 10, peak, headlines };
}

// Players who actually appear in the playoff shot set (for restricting pickers).
export function shotPlayerIds(shots: RealShot[], minShots = 6): Set<number> {
  const m = new Map<number, number>();
  for (const s of shots) m.set(s.espnId, (m.get(s.espnId) ?? 0) + 1);
  return new Set([...m.entries()].filter(([, c]) => c >= minShots).map(([id]) => id));
}

export function clutchLeaders(shots: RealShot[], minAtt = 6): ClutchLeader[] {
  const m = new Map<number, ClutchLeader>();
  for (const s of shots) {
    if (!isClutch(s)) continue;
    let e = m.get(s.espnId);
    if (!e) {
      e = { espnId: s.espnId, player: s.player, team: s.team, att: 0, made: 0, fgPct: 0, threeAtt: 0, threeMade: 0, threePct: 0, pts: 0, efg: 0 };
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
    }))
    .sort((a, b) => b.pts - a.pts);
}
