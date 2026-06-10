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
