// Inference layer for the CourtCommand models, trained on 2003-04 → 2024-25 data.
// Learned parameters are exported from the Python pipeline (model/train.py) as JSON
// and consumed here for real, in-app inference — no Python needed at runtime.

import shotQualityParams from "./params/shot_quality.json";
import winProbParams from "./params/win_probability.json";
import mvpParams from "./params/mvp_model.json";
import injuryParams from "./params/injury_risk.json";
import metadata from "./params/metadata.json";

export const MODEL_META = metadata;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

// ---------------- Shot Quality (logistic) ----------------
export type ModelShotType =
  | "rim"
  | "floater"
  | "midrange"
  | "catch3"
  | "pullup3"
  | "stepback3";

export interface ShotFeatures {
  shotType: ModelShotType;
  defenderDist: number;
  shotClock: number;
  touchTime: number;
  dribbles: number;
  catchAndShoot: boolean;
}

export interface ShotContribution {
  label: string;
  contribution: number; // logit contribution
}

export function predictShotMakeProb(f: ShotFeatures): {
  prob: number;
  contributions: ShotContribution[];
} {
  const p = shotQualityParams;
  const base = p.intercept + (p.shot_type_base as Record<string, number>)[f.shotType];
  const terms: ShotContribution[] = [
    { label: "Defender distance", contribution: p.coef.defender_dist * f.defenderDist },
    { label: "Shot clock", contribution: p.coef.shot_clock * f.shotClock },
    { label: "Touch time", contribution: p.coef.touch_time * f.touchTime },
    { label: "Dribbles", contribution: p.coef.dribbles * f.dribbles },
    {
      label: f.catchAndShoot ? "Catch & shoot" : "Off the dribble",
      contribution: p.coef.catch_and_shoot * (f.catchAndShoot ? 1 : 0),
    },
  ];
  const logit = base + terms.reduce((s, t) => s + t.contribution, 0);
  return { prob: sigmoid(logit), contributions: terms };
}

// ---------------- Win Probability (logistic) ----------------
export function predictWinProb(args: {
  margin: number;
  secondsLeft: number;
  homeHasBall: boolean;
  homeStrength: number;
}): number {
  const p = winProbParams;
  const time = Math.max(args.secondsLeft / 60, 0.1);
  const feats = {
    margin: args.margin,
    margin_over_sqrt_time: args.margin / Math.sqrt(time),
    time_frac: args.secondsLeft / 2880,
    possession: args.homeHasBall ? 1 : -1,
    home_strength: args.homeStrength,
  };
  const logit =
    p.intercept +
    p.coef.margin * feats.margin +
    p.coef.margin_over_sqrt_time * feats.margin_over_sqrt_time +
    p.coef.time_frac * feats.time_frac +
    p.coef.possession * feats.possession +
    p.coef.home_strength * feats.home_strength;
  return sigmoid(logit);
}

// ---------------- MVP share (linear) ----------------
export function predictMvpShare(args: {
  per: number;
  bpm: number;
  teamWins: number;
  ppg: number;
  ts: number; // 0..1
}): number {
  const p = mvpParams;
  const v =
    p.intercept +
    p.coef.per * args.per +
    p.coef.bpm * args.bpm +
    p.coef.team_wins * args.teamWins +
    p.coef.ppg * args.ppg +
    p.coef.ts * args.ts;
  return Math.max(0, v);
}

// ---------------- Injury risk (logistic) ----------------
export function predictInjuryProb(args: {
  age: number;
  mpg: number;
  gamesMissedPrev: number;
  b2bCount: number;
  frameIndex: number; // weight_lb / height_in
}): number {
  const p = injuryParams;
  const logit =
    p.intercept +
    p.coef.age * args.age +
    p.coef.mpg * args.mpg +
    p.coef.games_missed_prev * args.gamesMissedPrev +
    p.coef.b2b_count * args.b2bCount +
    p.coef.frame_index * args.frameIndex;
  return sigmoid(logit);
}

// ---------------- Provenance: which tools are model-backed ----------------
export interface ModelCard {
  name: string;
  kind: string;
  metric: string;
}

export const TOOL_MODELS: Record<string, ModelCard> = {
  "shot-quality": {
    name: "Shot Quality",
    kind: "Logistic regression · 320k shots",
    metric: `AUC ${shotQualityParams.metrics.auc.toFixed(2)}`,
  },
  "win-probability": {
    name: "Win Probability",
    kind: "Logistic regression · 208k game states",
    metric: `AUC ${winProbParams.metrics.auc.toFixed(2)} · Brier ${winProbParams.metrics.brier.toFixed(2)}`,
  },
  "award-predictor": {
    name: "MVP Share",
    kind: "Linear regression · 9.5k player-seasons",
    metric: `R² ${mvpParams.metrics.r2.toFixed(2)}`,
  },
  "injury-risk": {
    name: "Injury Risk",
    kind: "Logistic regression · 9.5k player-seasons",
    metric: `AUC ${injuryParams.metrics.auc.toFixed(2)}`,
  },
  "role-classifier": {
    name: "Archetypes",
    kind: "K-Means (k=8) · 9.5k player-seasons",
    metric: "8 clusters",
  },
};

export function getToolModel(slug: string): ModelCard | undefined {
  return TOOL_MODELS[slug];
}
