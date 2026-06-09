import raw from "./clips.real.json";
import type { RealShot } from "./shots";

// Real NBA shot clips (from the ShotSense dataset): each has a playable
// videos.nba.com MP4, the player, action, make/miss, a model xFG + grade, and
// the shot's court location. Used by the Shot Quality "Film Room" to show the
// actual video next to the model grade and the 2.5D replay recreation.
export interface RealClip {
  id: string;
  url: string;
  series: string;
  player: string;
  action: string;
  made: boolean;
  modelXfg: number;
  grade: string;
  metrics: {
    releaseAngleDeg: number;
    releaseHeightFt: number;
    bodyLeanDeg: number;
    timeToReleaseMs: number;
  };
  inputs: { where: string; when: string; how: string; situation: string };
  shotLocation: { x: number; y: number };
}

export const REAL_CLIPS = raw as unknown as RealClip[];

// NBA coords (x ±250, y -52.5..417.5, hoop at origin, tenths of a foot) →
// CourtChart coords (viewBox 500×470, hoop at 250,62).
export function clipCourt(c: RealClip): { x: number; y: number } {
  const x = 250 + (c.shotLocation.x / 250) * 220;
  const y = 62 + (Math.max(0, c.shotLocation.y) / 417.5) * 398;
  return {
    x: Math.max(20, Math.min(480, Math.round(x))),
    y: Math.max(20, Math.min(460, Math.round(y))),
  };
}

export function clipDistFt(c: RealClip): number {
  return Math.round(Math.hypot(c.shotLocation.x, c.shotLocation.y) / 10);
}

export function clipIsThree(c: RealClip): boolean {
  return /3|three|above the break|corner 3/i.test(`${c.action} ${c.inputs.where}`);
}

export function clipShotType(c: RealClip): RealShot["shotType"] {
  const t = `${c.action} ${c.inputs.how}`.toLowerCase();
  const dist = clipDistFt(c);
  if (clipIsThree(c)) {
    if (/step ?back/.test(t)) return "stepback3";
    if (/pull|driving|turnaround|fade|running/.test(t)) return "pullup3";
    return "catch3";
  }
  if (dist <= 4 || /dunk|layup|alley|tip|hook|cutting|putback/.test(t)) return "rim";
  if (dist <= 9 || /float|runner/.test(t)) return "floater";
  return "midrange";
}

export function clipPeriod(c: RealClip): number {
  const m = c.inputs.when.match(/Q(\d)/i);
  return m ? parseInt(m[1], 10) : 1;
}

// Build a RealShot-shaped object so the trained model can grade a clip.
export function clipToShot(c: RealClip): RealShot {
  const court = clipCourt(c);
  const three = clipIsThree(c);
  return {
    id: c.id,
    espnId: 0,
    player: c.player,
    team: "",
    gameId: c.id.split("-")[0] ?? "",
    game: c.series,
    date: "",
    period: clipPeriod(c),
    clock: c.inputs.when.replace(/^Q\d\s*·?\s*/i, ""),
    dist: clipDistFt(c),
    value: three ? 3 : 2,
    made: c.made,
    assisted: /catch|spot/i.test(c.action),
    shotType: clipShotType(c),
    typeText: c.action,
    text: `${c.player} · ${c.action}`,
    x: court.x,
    y: court.y,
  };
}

export interface ClipPlayer {
  player: string;
  count: number;
  made: number;
}

// Players grouped, makes first so the default selection is satisfying video.
export const CLIP_PLAYERS: ClipPlayer[] = (() => {
  const m = new Map<string, ClipPlayer>();
  for (const c of REAL_CLIPS) {
    const e = m.get(c.player);
    if (e) {
      e.count++;
      if (c.made) e.made++;
    } else m.set(c.player, { player: c.player, count: 1, made: c.made ? 1 : 0 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.made - a.made);
})();

export function clipsForPlayer(player: string): RealClip[] {
  return REAL_CLIPS.filter((c) => c.player === player).sort(
    (a, b) => Number(b.made) - Number(a.made) || b.modelXfg - a.modelXfg,
  );
}

// A strong default: a made shot with a clean grade.
export const DEFAULT_CLIP_ID =
  REAL_CLIPS.find((c) => c.made && /A|B/.test(c.grade))?.id ?? REAL_CLIPS[0]?.id ?? "";
