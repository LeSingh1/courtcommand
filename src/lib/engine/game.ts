import type { Player } from "@/lib/types";
import { TEAM_MAP } from "@/lib/data";
import { predictShotMakeProb, predictWinProb } from "@/lib/model";
import { gameMomentum, type RealShot } from "@/lib/data/shots";

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
  difficulty_score: number; // 0-100, inverse read of the quality drivers (contest, clock, dribbles, touch, type)
  risk_factors: string[]; // threshold-derived flags ("late clock", "tight closeout", ...)
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

// Baseline difficulty of the attempt type itself, 0-100 (a wide-open step-back
// is still harder to hit than a wide-open layup). Anchored to the model's
// shot_type_base ordering: rim easiest, step-back three hardest.
const TYPE_DIFFICULTY: Record<ShotType, number> = {
  rim: 15,
  floater: 45,
  midrange: 50,
  catch3: 35,
  pullup3: 70,
  stepback3: 80,
};

// Hard physical bounds — inputs outside these are rejected with a clear error.
const SHOT_INPUT_BOUNDS = {
  defenderDist: { min: 0, max: 40, unit: "ft" },
  shotClock: { min: 0, max: 24, unit: "s" },
  dribbles: { min: 0, max: 40, unit: "" },
  touchTime: { min: 0, max: 24, unit: "s" },
} as const;

// Soft model range — valid-but-extreme inputs are clamped to where the
// training data lives before scoring.
const SHOT_INPUT_CLAMP = {
  defenderDist: { min: 0, max: 20 },
  shotClock: { min: 0, max: 24 },
  dribbles: { min: 0, max: 20 },
  touchTime: { min: 0, max: 24 },
} as const;

// Validate then normalize a shot input: reject non-finite / out-of-bounds
// values with clear error strings, clamp the rest into the model's range.
export function validateShotInput(input: ShotInput): ShotInput {
  if (!(input.shotType in BASE_FG)) {
    throw new Error(
      `Unknown shotType "${String(input.shotType)}" — expected one of: ${Object.keys(BASE_FG).join(", ")}.`,
    );
  }
  for (const key of ["defenderDist", "shotClock", "dribbles", "touchTime"] as const) {
    const v = input[key];
    const b = SHOT_INPUT_BOUNDS[key];
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid ${key}: expected a finite number, got ${String(v)}.`);
    }
    if (v < b.min || v > b.max) {
      throw new Error(`${key} out of range: ${v}${b.unit} (expected ${b.min}-${b.max}${b.unit}).`);
    }
  }
  return {
    ...input,
    defenderDist: clamp(input.defenderDist, SHOT_INPUT_CLAMP.defenderDist.min, SHOT_INPUT_CLAMP.defenderDist.max),
    shotClock: clamp(input.shotClock, SHOT_INPUT_CLAMP.shotClock.min, SHOT_INPUT_CLAMP.shotClock.max),
    dribbles: clamp(Math.round(input.dribbles), SHOT_INPUT_CLAMP.dribbles.min, SHOT_INPUT_CLAMP.dribbles.max),
    touchTime: clamp(input.touchTime, SHOT_INPUT_CLAMP.touchTime.min, SHOT_INPUT_CLAMP.touchTime.max),
  };
}

// Threshold-derived risk flags — each is a deterministic read of one input.
export function shotRiskFactors(i: ShotInput): string[] {
  const flags: string[] = [];
  if (i.shotClock <= 4) flags.push("late clock");
  if (i.defenderDist < 3) flags.push("tight closeout");
  if (i.dribbles >= 5) flags.push("off 5+ dribbles");
  if (i.touchTime >= 5) flags.push("long touch time");
  if (i.shotType === "stepback3") flags.push("step-back penalty");
  if (i.shotType === "pullup3") flags.push("off-the-dribble three");
  return flags;
}

// 0-100 difficulty index: a weighted inverse of the quality drivers.
// Contest 30% + clock pressure 20% + dribble load 15% + touch time 10% + attempt type 25%.
function shotDifficulty(i: ShotInput): number {
  const contest = clamp((10 - i.defenderDist) / 10, 0, 1) * 100;
  const clockPressure = clamp((8 - i.shotClock) / 8, 0, 1) * 100;
  const dribbleLoad = clamp(i.dribbles / 8, 0, 1) * 100;
  const touchLoad = clamp((i.touchTime - 2) / 6, 0, 1) * 100;
  const score =
    0.3 * contest + 0.2 * clockPressure + 0.15 * dribbleLoad + 0.1 * touchLoad + 0.25 * TYPE_DIFFICULTY[i.shotType];
  return Math.round(clamp(score, 0, 100));
}

export function shotQuality(rawInput: ShotInput): ShotQualityResult {
  const input = validateShotInput(rawInput);
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
    difficulty_score: shotDifficulty(input),
    risk_factors: shotRiskFactors(input),
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

export interface WPCurve {
  teams: string[];
  t: number[];
  home: number[]; // WP % for teams[0]
  events: { t: number; label: string }[];
  finalMargin: number;
}

function curveClockSecs(clock: string): number {
  const m = (clock || "").match(/(\d+):(\d+)/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
}
function pointSecondsLeft(period: number, clock: string): number {
  const cs = curveClockSecs(clock);
  if (period <= 4) return Math.max(0, (4 - period) * 720 + cs); // 12-min quarters
  return Math.max(0, cs); // overtime — already at the end of regulation
}

// Real win-probability curve for an actual playoff game: each real field-goal
// margin + game clock is run through the trained WP model, with team strength
// set from each side's real season net rating. Margin is field-goal only (free
// throws aren't in public play-by-play), so it's a faithful approximation.
export function gameWinProbCurve(shots: RealShot[], gameId: string): WPCurve | null {
  const mom = gameMomentum(shots, gameId);
  if (mom.teams.length < 2 || mom.timeline.length < 4) return null;
  const [A, B] = mom.teams;
  const ta = TEAM_MAP[A];
  const tb = TEAM_MAP[B];
  const netA = ta ? ta.ortg - ta.drtg : 0;
  const netB = tb ? tb.ortg - tb.drtg : 0;
  const homeStrength = clamp(netA - netB, -10, 10);
  const home: number[] = [];
  const t: number[] = [];
  mom.timeline.forEach((p, i) => {
    const wp = winProbability({
      margin: p.margin,
      secondsLeft: pointSecondsLeft(p.period, p.clock),
      homeHasBall: i % 2 === 0,
      homeStrength,
    });
    home.push(Math.round(wp));
    t.push(i);
  });
  const events = mom.runs
    .slice(0, 4)
    .map((r) => ({ t: Math.min(r.endIdx, t.length - 1), label: `${r.pts}-0 ${r.team} run` }))
    .sort((a, b) => a.t - b.t);
  return { teams: [A, B], t, home, events, finalMargin: mom.timeline.at(-1)?.margin ?? 0 };
}

// ---------------- WP swings & turning point ----------------
export interface WPSwing {
  index: number; // position in the curve (the step *into* this point)
  delta: number; // signed change in teams[0] WP, percentage points
  label: string;
}
export interface WPSwingReport {
  swings: WPSwing[]; // up to 3, largest absolute single-step moves, ties broken by earliest
  turningPoint: { index: number; team: string; wp: number; label: string } | null; // last lead-probability flip
}

// Deterministic read of an already-computed WP curve: the 3 largest
// single-step swings, and the last time the probability lead (50% line)
// changed hands. Null turning point means wire-to-wire.
export function biggestSwings(curve: Pick<WPCurve, "teams" | "home">): WPSwingReport {
  const { home } = curve;
  const [A, B] = curve.teams;
  const n = home.length;
  if (n < 2) return { swings: [], turningPoint: null };

  const steps: WPSwing[] = [];
  for (let i = 1; i < n; i++) {
    const delta = home[i] - home[i - 1];
    if (delta === 0) continue;
    const team = delta > 0 ? A : B;
    steps.push({
      index: i,
      delta,
      label: `${team} +${Math.abs(delta)}% WP on make ${i + 1} of ${n}`,
    });
  }
  const swings = [...steps]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.index - b.index)
    .slice(0, 3);

  let turningPoint: WPSwingReport["turningPoint"] = null;
  for (let i = 1; i < n; i++) {
    const wasA = home[i - 1] >= 50;
    const nowA = home[i] >= 50;
    if (wasA !== nowA) {
      const team = nowA ? A : B;
      turningPoint = { index: i, team, wp: home[i], label: `${team} take the WP lead for good` };
    }
  }
  return { swings, turningPoint };
}

// Shot Chart now plots real playoff attempts (lib/data/shots#realShotChart); the
// old per-player synthetic shot generator was removed when that tool — and the
// homepage teaser — were reworked onto real data. Ref Bias likewise reports real
// free-throw rate (lib/data/ftrate) rather than a synthetic whistle generator.

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
export type HeadlineStyle = "straight" | "dramatic" | "stat-led";
export interface HeadlineOption {
  style: HeadlineStyle;
  text: string;
}
export interface RecapResult {
  headline: string;
  headline_options: HeadlineOption[]; // 3 distinct: straight, dramatic, stat-led
  body: string[];
  key_facts: string[]; // 4-6 verifiable facts straight from the box input
  topPerformer: BoxLine | null; // null when no star lines were provided
}

export function gameRecap(i: RecapInput): RecapResult {
  const home = TEAM_MAP[i.homeTeam];
  const away = TEAM_MAP[i.awayTeam];
  // Graceful fallback for unknown abbreviations — never crash on input.
  const homeCity = home?.city ?? i.homeTeam;
  const homeName = home?.name ?? i.homeTeam;
  const awayCity = away?.city ?? i.awayTeam;
  const awayName = away?.name ?? i.awayTeam;
  const homeWon = i.homeScore > i.awayScore;
  const winnerCity = homeWon ? homeCity : awayCity;
  const winnerName = homeWon ? homeName : awayName;
  const loserName = homeWon ? awayName : homeName;
  const winScore = homeWon ? i.homeScore : i.awayScore;
  const loseScore = homeWon ? i.awayScore : i.homeScore;
  const margin = winScore - loseScore;
  const allStars = [...(i.homeStars ?? []), ...(i.awayStars ?? [])];
  const top = allStars.length ? allStars.reduce((m, s) => (s.pts > m.pts ? s : m), allStars[0]) : null;
  const topAst = allStars.length ? allStars.reduce((m, s) => (s.ast > m.ast ? s : m), allStars[0]) : null;
  const closeness = margin <= 4 ? "a nail-biter" : margin <= 10 ? "a tight contest" : "a comfortable win";

  const headline = `${winnerCity} ${winnerName} ${homeWon ? "hold off" : "stun"} ${loserName}, ${winScore}-${loseScore}`;
  const dramatic =
    margin <= 4
      ? `${winnerName} survive ${loserName} thriller, ${winScore}-${loseScore}`
      : margin >= 15
        ? `${winnerName} bury ${loserName} in ${margin}-point statement`
        : `${winnerName} pull away late from ${loserName}, ${winScore}-${loseScore}`;
  const statLed = top
    ? `${top.name} pours in ${top.pts} as ${winnerName} top ${loserName}`
    : `${winnerName} ride ${winScore}-point night past ${loserName}`;
  const headline_options: HeadlineOption[] = [
    { style: "straight", text: `${winnerCity} ${winnerName} beat ${loserName} ${winScore}-${loseScore}` },
    { style: "dramatic", text: dramatic },
    { style: "stat-led", text: statLed },
  ];

  const key_facts: string[] = [
    `Final: ${winnerName} ${winScore}, ${loserName} ${loseScore}`,
    `Margin of victory: ${margin} ${margin === 1 ? "point" : "points"}${margin <= 3 ? " (single possession)" : ""}`,
    `Combined scoring: ${i.homeScore + i.awayScore} points`,
    `${winnerName} won ${homeWon ? "at home" : "on the road"}`,
  ];
  if (top) key_facts.push(`Top scorer in the box input: ${top.name} with ${top.pts} points`);
  if (topAst && topAst.ast > 0) key_facts.push(`Most assists in the box input: ${topAst.name} with ${topAst.ast}`);

  const body = [
    top
      ? `The ${winnerName} secured ${closeness} over the ${loserName} on ${winScore}-${loseScore}, led by ${top.name}'s ${top.pts}-point, ${top.reb}-rebound, ${top.ast}-assist line.`
      : `The ${winnerName} secured ${closeness} over the ${loserName} on ${winScore}-${loseScore}.`,
    margin <= 6
      ? `The game stayed within one possession down the stretch before ${winnerCity} closed on a decisive late run.`
      : `${winnerCity} controlled the margin after halftime and never let the lead slip into single digits late.`,
    top
      ? `${i.homeStars[0]?.name ?? "The home side"} and ${i.awayStars[0]?.name ?? "the visitors"} traded buckets early, but it was ${top.name} who tilted the night.`
      : `No individual star lines were supplied with this box score, so the night reads as a collective ${winnerName} effort.`,
    `Up next, both teams turn the page with the result reshaping their standings position.`,
  ];
  return { headline, headline_options, body, key_facts, topPerformer: top };
}

// Highlight detection now scores real playoff makes (lib/data/shots#highlightReel);
// the old synthetic clip generator was removed when that tool was reworked.

// ---------------- Grade a REAL shot ----------------
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
