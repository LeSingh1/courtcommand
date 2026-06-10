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
