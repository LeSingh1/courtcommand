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
