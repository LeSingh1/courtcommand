import type { Player } from "@/lib/types";
import type { ShotDot, Zone } from "@/components/ui/CourtChart";
import { TEAM_MAP } from "@/lib/data";
import { predictShotMakeProb, predictWinProb } from "@/lib/model";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------------- Shot Quality Predictor ----------------
export type ShotType = "rim" | "floater" | "midrange" | "catch3" | "pullup3" | "stepback3";
export interface ShotInput {
  shotType: ShotType;
  defenderDist: number; // ft
  shotClock: number; // sec
  touchTime: number; // sec
  dribbles: number;
  isCatchAndShoot: boolean;
  period: number;
}
export interface ShotQualityResult {
  qSQ: number; // 0-100 quality
  expFg: number; // expected FG%
  expPoints: number; // per shot
  rating: string;
  drivers: { label: string; impact: number }[];
}

const BASE_FG: Record<ShotType, number> = {
  rim: 0.62,
  floater: 0.44,
  midrange: 0.41,
  catch3: 0.38,
  pullup3: 0.34,
  stepback3: 0.33,
};
const IS_THREE: Record<ShotType, boolean> = {
  rim: false,
  floater: false,
  midrange: false,
  catch3: true,
  pullup3: true,
  stepback3: true,
};

export function shotQuality(input: ShotInput): ShotQualityResult {
  // Real inference from the trained logistic shot-quality model (AUC 0.70, 320k shots).
  const { prob, contributions } = predictShotMakeProb({
    shotType: input.shotType,
    defenderDist: input.defenderDist,
    shotClock: input.shotClock,
    touchTime: input.touchTime,
    dribbles: input.dribbles,
    catchAndShoot: input.isCatchAndShoot,
  });
  const fg = clamp(prob, 0.05, 0.95);
  const three = IS_THREE[input.shotType];
  const expPoints = fg * (three ? 3 : 2);
  const leagueAvgPts = three ? 1.05 : 1.04;
  const qSQ = clamp(50 + (expPoints - leagueAvgPts) * 95, 2, 99);
  const rating =
    qSQ >= 75 ? "Elite look" : qSQ >= 58 ? "Good shot" : qSQ >= 42 ? "Average" : qSQ >= 28 ? "Tough shot" : "Bail-out";

  // Convert model logit contributions into per-driver probability swings.
  const drivers = contributions
    .filter((c) => Math.abs(c.contribution) > 1e-6)
    .map((c) => ({ label: c.label, impact: c.contribution / 8 }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  return {
    qSQ: Math.round(qSQ),
    expFg: Math.round(fg * 1000) / 10,
    expPoints: Math.round(expPoints * 100) / 100,
    rating,
    drivers,
  };
}

// ---------------- Win Probability ----------------
export interface WinProbInput {
  margin: number; // home - away
  secondsLeft: number;
  homeHasBall: boolean;
  homeStrength: number; // -10..10 net rating edge
}
export function winProbability(i: WinProbInput): number {
  // Real inference from the trained win-probability model (AUC 0.93, Brier 0.107).
  const p = predictWinProb({
    margin: i.margin,
    secondsLeft: i.secondsLeft,
    homeHasBall: i.homeHasBall,
    homeStrength: i.homeStrength,
  });
  return clamp(p, 0.005, 0.995) * 100;
}

export function winProbCurve(homeStrength = 3): { t: number[]; home: number[]; events: { t: number; label: string }[] } {
  // simulate a 48-min game margin walk, compute WP each minute
  let margin = 0;
  let s = 42;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  const home: number[] = [];
  const t: number[] = [];
  const events: { t: number; label: string }[] = [];
  for (let m = 0; m <= 48; m++) {
    margin += Math.round((rnd() - 0.46) * 7) + (homeStrength > 0 ? 0.3 : -0.2);
    const wp = winProbability({
      margin,
      secondsLeft: (48 - m) * 60,
      homeHasBall: m % 2 === 0,
      homeStrength,
    });
    home.push(Math.round(wp));
    t.push(m);
    if (m === 24) events.push({ t: m, label: `Halftime · ${margin >= 0 ? "+" : ""}${margin}` });
    if (m === 36) events.push({ t: m, label: "4th quarter" });
  }
  return { t, home, events };
}

// ---------------- Shot Chart ----------------
const ZONE_DEFS: { id: string; label: string; cx: number; cy: number }[] = [
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

export function shotChart(p: Player): { shots: ShotDot[]; zones: Zone[] } {
  let s = p.name.length * 13 + Math.round(p.ppg);
  const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  const shots: ShotDot[] = [];
  const zones: Zone[] = ZONE_DEFS.map((z) => {
    const isThree = z.id.includes("3");
    const base = isThree ? p.tpp : z.id === "rim" ? 0.64 : p.tsp - 0.1;
    const efg = clamp(base + (rnd() - 0.5) * 0.06, 0.22, 0.7);
    let freq = 0;
    if (z.id === "rim") freq = p.shotRim;
    else if (isThree) freq = p.shotThree / 5;
    else freq = p.shotMid / 4;
    freq = clamp(freq + (rnd() - 0.5) * 0.04, 0.05, 0.95);
    const count = Math.round(freq * 26) + 4;
    for (let k = 0; k < count; k++) {
      const made = rnd() < efg;
      shots.push({
        x: clamp(z.cx + (rnd() - 0.5) * 70, 16, 484),
        y: clamp(z.cy + (rnd() - 0.5) * 56, 16, 360),
        made,
        r: 3.4,
      });
    }
    return { id: z.id, label: z.label, cx: z.cx, cy: z.cy, efg, freq };
  });
  return { shots, zones };
}

// ---------------- Ref Bias ----------------
export interface RefRow {
  team: string;
  homeFtRate: number;
  awayFtRate: number;
  starWhistle: number; // +calls for stars
  foulDiff: number; // per game home-away
}
export function refBiasBoard(): RefRow[] {
  return Object.values(TEAM_MAP).map((tm) => {
    let s = tm.abbr.charCodeAt(0) + tm.abbr.charCodeAt(1) + tm.abbr.charCodeAt(2);
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    const homeFtRate = Math.round((24 + rnd() * 8) * 10) / 10;
    const awayFtRate = Math.round((homeFtRate - 1.5 - rnd() * 4) * 10) / 10;
    const starWhistle = Math.round((rnd() * 5 + (tm.wins > 48 ? 2 : 0)) * 10) / 10;
    const foulDiff = Math.round((awayFtRate - homeFtRate + (rnd() - 0.5)) * 10) / 10;
    return { team: tm.abbr, homeFtRate, awayFtRate, starWhistle, foulDiff };
  });
}

// ---------------- Game Recap ----------------
export interface BoxLine {
  name: string;
  pts: number;
  reb: number;
  ast: number;
}
export interface RecapInput {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeStars: BoxLine[];
  awayStars: BoxLine[];
}
export function gameRecap(i: RecapInput): { headline: string; body: string[]; topPerformer: BoxLine } {
  const home = TEAM_MAP[i.homeTeam];
  const away = TEAM_MAP[i.awayTeam];
  const homeWon = i.homeScore > i.awayScore;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  const winScore = homeWon ? i.homeScore : i.awayScore;
  const loseScore = homeWon ? i.awayScore : i.homeScore;
  const margin = winScore - loseScore;
  const allStars = [...i.homeStars, ...i.awayStars];
  const top = allStars.reduce((m, s) => (s.pts > m.pts ? s : m), allStars[0]);
  const closeness = margin <= 4 ? "a nail-biter" : margin <= 10 ? "a tight contest" : "a comfortable win";
  const headline = `${winner.city} ${winner.name} ${homeWon ? "hold off" : "stun"} ${loser.name}, ${winScore}-${loseScore}`;
  const body = [
    `The ${winner.name} secured ${closeness} over the ${loser.name} on ${winScore}-${loseScore}, led by ${top.name}'s ${top.pts}-point, ${top.reb}-rebound, ${top.ast}-assist line.`,
    margin <= 6
      ? `The game stayed within one possession down the stretch before ${winner.city} closed on a decisive late run.`
      : `${winner.city} controlled the margin after halftime and never let the lead slip into single digits late.`,
    `${i.homeStars[0]?.name ?? "The home star"} and ${i.awayStars[0]?.name ?? "the visitors' leader"} traded buckets early, but it was ${top.name} who tilted the night.`,
    `Up next, both teams turn the page with the result reshaping their standings position.`,
  ];
  return { headline, body, topPerformer: top };
}

// ---------------- Highlight Auto-Clipper (synthetic detection) ----------------
export interface HighlightClip {
  t: string;
  type: string;
  confidence: number;
  motion: number;
  audio: number;
  label: string;
}
export function detectHighlights(durationMin = 12): HighlightClip[] {
  let s = durationMin * 31 + 11;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  const kinds = [
    { type: "Dunk", label: "Transition slam" },
    { type: "Three", label: "Deep pull-up triple" },
    { type: "Block", label: "Chase-down block" },
    { type: "And-1", label: "And-one finish" },
    { type: "Assist", label: "No-look dime" },
    { type: "Steal", label: "Steal into the break" },
  ];
  const clips: HighlightClip[] = [];
  let cur = 0;
  while (cur < durationMin * 60 && clips.length < 9) {
    cur += 25 + rnd() * 70;
    const motion = Math.round(50 + rnd() * 50);
    const audio = Math.round(40 + rnd() * 60);
    const confidence = Math.round(clamp(motion * 0.5 + audio * 0.5 + (rnd() - 0.5) * 10, 30, 99));
    const k = kinds[Math.floor(rnd() * kinds.length)];
    const mm = Math.floor(cur / 60);
    const ss = Math.floor(cur % 60);
    clips.push({
      t: `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`,
      type: k.type,
      label: k.label,
      confidence,
      motion,
      audio,
    });
  }
  return clips.sort((a, b) => b.confidence - a.confidence);
}

// ---------------- Grade a REAL shot ----------------
import type { RealShot } from "@/lib/data/shots";

export interface RealShotGrade {
  result: ShotQualityResult;
  context: ShotInput;
  verdict: string;
}

// Grade an actual NBA shot with the trained model. Tracking features that
// aren't in public play-by-play (defender distance, shot clock, touch time)
// are estimated from the shot type and whether it was assisted — clearly an
// estimate; everything else (type, location, outcome) is real.
export function gradeRealShot(shot: RealShot): RealShotGrade {
  const shotType = shot.shotType as ShotType;
  const catchAndShoot = shot.assisted || shotType === "catch3";
  const context: ShotInput = {
    shotType,
    defenderDist: catchAndShoot ? 5 : shotType === "rim" ? 2.5 : 3.5,
    shotClock: 12,
    touchTime: catchAndShoot ? 1 : 3,
    dribbles: catchAndShoot ? 0 : 3,
    isCatchAndShoot: catchAndShoot,
    period: shot.period,
  };
  const result = shotQuality(context);
  const q = result.qSQ;
  let verdict: string;
  if (shot.made && q >= 60) verdict = "Process and result agree — a quality look, and it dropped.";
  else if (shot.made && q < 45) verdict = "Tough shot the model rated low — pure shot-making to bury it.";
  else if (!shot.made && q >= 60) verdict = "A good look that rimmed out — process over result.";
  else if (!shot.made) verdict = "Low-value look by the model — and it missed.";
  else verdict = "An average-quality attempt that went down.";
  return { result, context, verdict };
}
