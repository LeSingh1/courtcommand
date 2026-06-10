// Shot-making over expected — the shooter prior.
//
// The shot-quality model grades the LOOK (context). The gap between a
// player's actual conversion and the model's expected conversion on his own
// real attempts is shot-MAKING skill: did he beat the looks he took? Thin
// samples are shrunk toward zero (n/(n+k)), so nobody earns a shot-making
// label off a hot week.
import type { RealShot } from "@/lib/data/shots";
import { gradeRealShot } from "@/lib/engine/game";
import { shrinkToZero } from "@/lib/engine/stats";

export interface ShotMakingRow {
  espnId: number;
  player: string;
  team: string;
  n: number; // graded attempts
  expPct: number; // model-expected FG% on his actual attempts
  actPct: number; // actual FG%
  rawDelta: number; // actual − expected, percentage points
  adjDelta: number; // shrunk toward 0 with k pseudo-attempts
}

export const SHOTMAKING_PRIOR_K = 50;

export function shotMakingBoard(
  shots: RealShot[],
  minAtt = 40,
  k = SHOTMAKING_PRIOR_K,
): ShotMakingRow[] {
  const agg = new Map<number, { player: string; team: string; n: number; made: number; exp: number }>();
  for (const s of shots) {
    let a = agg.get(s.espnId);
    if (!a) {
      a = { player: s.player, team: s.team, n: 0, made: 0, exp: 0 };
      agg.set(s.espnId, a);
    }
    a.n++;
    if (s.made) a.made++;
    a.exp += gradeRealShot(s).result.expFg / 100;
  }
  const rows: ShotMakingRow[] = [];
  for (const [espnId, a] of agg) {
    if (a.n < minAtt) continue;
    const actPct = a.made / a.n;
    const expPct = a.exp / a.n;
    const rawDelta = (actPct - expPct) * 100;
    rows.push({
      espnId,
      player: a.player,
      team: a.team,
      n: a.n,
      expPct: Math.round(expPct * 1000) / 10,
      actPct: Math.round(actPct * 1000) / 10,
      rawDelta: Math.round(rawDelta * 10) / 10,
      adjDelta: Math.round(shrinkToZero(rawDelta, a.n, k) * 10) / 10,
    });
  }
  return rows.sort((x, y) => y.adjDelta - x.adjDelta);
}

export function shotMakingFor(board: ShotMakingRow[], espnId: number): ShotMakingRow | null {
  return board.find((r) => r.espnId === espnId) ?? null;
}
