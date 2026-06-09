import raw from "./shots.real.json";

// Real NBA shots from recent games (ESPN play-by-play): player, shot type,
// court coordinates, distance, make/miss, and game context.
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

export const REAL_SHOTS = raw as unknown as RealShot[];

export function shotsForPlayer(espnId: number): RealShot[] {
  return REAL_SHOTS.filter((s) => s.espnId === espnId).sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );
}

export interface ShotPlayer {
  espnId: number;
  player: string;
  team: string;
  count: number;
}

export const SHOT_PLAYERS: ShotPlayer[] = (() => {
  const m = new Map<number, ShotPlayer>();
  for (const s of REAL_SHOTS) {
    const e = m.get(s.espnId);
    if (e) e.count++;
    else m.set(s.espnId, { espnId: s.espnId, player: s.player, team: s.team, count: 1 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
})();

export const SHOT_PLAYER_IDS = new Set(SHOT_PLAYERS.map((p) => p.espnId));
