import type { Player } from "@/lib/types";
import { PLAYERS, getPlayer, TEAM_MAP } from "@/lib/data";
import { letterGrade } from "@/lib/cn";
import { predictMvpShare, predictInjuryProb } from "@/lib/model";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------------- Player Similarity (HoopRadar) ----------------
const SIM_AXES: { key: keyof Player; label: string; weight: number; scale: number }[] = [
  { key: "ppg", label: "Scoring", weight: 1.0, scale: 35 },
  { key: "rpg", label: "Rebounding", weight: 0.9, scale: 14 },
  { key: "apg", label: "Playmaking", weight: 1.0, scale: 12 },
  { key: "usg", label: "Usage", weight: 1.1, scale: 36 },
  { key: "tsp", label: "Efficiency", weight: 1.0, scale: 0.65 },
  { key: "shotThree", label: "3PT Rate", weight: 1.0, scale: 0.8 },
  { key: "defImpact", label: "Defense", weight: 0.9, scale: 100 },
  { key: "spg", label: "Steals", weight: 0.6, scale: 2.2 },
  { key: "bpg", label: "Blocks", weight: 0.6, scale: 3.8 },
];

export interface SimResult {
  player: Player;
  score: number; // 0-100 similarity
  reasons: string[];
}

export function similarPlayers(id: string, limit = 6): SimResult[] {
  const target = getPlayer(id);
  if (!target) return [];
  const vec = (p: Player) => SIM_AXES.map((a) => (Number(p[a.key]) / a.scale) * a.weight);
  const tv = vec(target);

  return PLAYERS.filter((p) => p.id !== id)
    .map((p) => {
      const pv = vec(p);
      let dist = 0;
      for (let i = 0; i < tv.length; i++) dist += (tv[i] - pv[i]) ** 2;
      dist = Math.sqrt(dist);
      const score = clamp(100 - dist * 26, 0, 99);
      const reasons: string[] = [];
      if (Math.abs(p.usg - target.usg) < 3) reasons.push("similar usage load");
      if (Math.abs(p.shotThree - target.shotThree) < 0.08) reasons.push("matching shot diet");
      if (Math.abs(p.apg - target.apg) < 1.5) reasons.push("comparable playmaking");
      if (Math.abs(p.defImpact - target.defImpact) < 10) reasons.push("same defensive tier");
      if (p.archetype === target.archetype) reasons.push(`both ${p.archetype.toLowerCase()}s`);
      return { player: p, score: Math.round(score), reasons: reasons.slice(0, 3) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function radarValues(p: Player): number[] {
  return [
    clamp((p.ppg / 35) * 100, 0, 100),
    clamp((p.rpg / 14) * 100, 0, 100),
    clamp((p.apg / 12) * 100, 0, 100),
    clamp(((p.tsp - 0.45) / 0.22) * 100, 0, 100),
    clamp(p.defImpact, 0, 100),
    clamp((p.shotThree / 0.7) * 100, 0, 100),
  ];
}
export const RADAR_AXES = ["SCORE", "REB", "AST", "EFF", "DEF", "3PT"];

// ---------------- Clutch (ClutchGene) ----------------
export interface ClutchRow {
  player: Player;
  clutchScore: number;
  poise: number;
  difficulty: number;
  grade: string;
}

export function clutchBoard(): ClutchRow[] {
  return PLAYERS.map((p) => {
    const poise = clamp((p.ftp - 0.7) * 120 + (p.clutchFgp - 0.42) * 160 + 40, 0, 100);
    const difficulty = clamp(p.clutchUsg * 1.8 + p.shotThree * 30 + (p.usg - 20) * 0.8, 10, 100);
    const volume = clamp(p.clutchPpg * 16, 0, 100);
    const clutchScore = clamp(
      poise * 0.42 + volume * 0.3 + difficulty * 0.18 + (p.starPower / 100) * 10,
      0,
      100,
    );
    return {
      player: p,
      clutchScore: Math.round(clutchScore),
      poise: Math.round(poise),
      difficulty: Math.round(difficulty),
      grade: letterGrade(clutchScore),
    };
  }).sort((a, b) => b.clutchScore - a.clutchScore);
}

// ---------------- Contract Value ----------------
export interface ContractRow {
  player: Player;
  produced: number; // $M of on-court value
  surplus: number; // produced - salary
  verdict: "Bargain" | "Fair" | "Overpaid";
  grade: string;
}

export function contractBoard(): ContractRow[] {
  return PLAYERS.map((p) => {
    // value model: win-share-ish * $ per win + availability + age curve
    const winValue = (p.bpm + 2) * 3.4 + p.per * 0.35;
    const availability = clamp(p.gp / 70, 0.4, 1.05);
    const ageMult = p.age <= 27 ? 1.08 : p.age <= 31 ? 1.0 : p.age <= 34 ? 0.9 : 0.8;
    const produced = Math.max(1, winValue * availability * ageMult);
    const surplus = produced - p.salary;
    const verdict: ContractRow["verdict"] = surplus > 8 ? "Bargain" : surplus > -6 ? "Fair" : "Overpaid";
    return {
      player: p,
      produced: Math.round(produced * 10) / 10,
      surplus: Math.round(surplus * 10) / 10,
      verdict,
      grade: letterGrade(clamp(50 + surplus * 2.4, 5, 99)),
    };
  }).sort((a, b) => b.surplus - a.surplus);
}

// ---------------- Role Classifier ----------------
export interface RoleCluster {
  role: string;
  blurb: string;
  color: string;
  players: Player[];
}

const ROLE_COLORS: Record<string, string> = {
  "Primary Creator": "#E0561F",
  "Volume Scorer": "#E0561F",
  "Secondary Playmaker": "#C9A14A",
  "3 and D Wing": "#7E8CA0",
  "Floor Spacer": "#7E8CA0",
  "Perimeter Stopper": "#5FA97E",
  "Rim Protector": "#7E8CA0",
  "Stretch Big": "#FF9A45",
  "Playmaking Big": "#C9A14A",
  Slasher: "#BF5B4E",
  "Combo Guard": "#5FA97E",
  Connector: "#9aa6b5",
};

export function roleClusters(): RoleCluster[] {
  const map = new Map<string, Player[]>();
  for (const p of PLAYERS) {
    if (!map.has(p.archetype)) map.set(p.archetype, []);
    map.get(p.archetype)!.push(p);
  }
  const blurbs: Record<string, string> = {
    "Primary Creator": "On-ball engines who generate offense for everyone.",
    "Volume Scorer": "High-usage buckets who carry the scoring load.",
    "Secondary Playmaker": "Connective passers who keep the ball moving.",
    "3 and D Wing": "Spacing plus point-of-attack defense.",
    "Floor Spacer": "Gravity shooters who bend the defense.",
    "Perimeter Stopper": "Disruptive hands and matchup erasers.",
    "Rim Protector": "Anchors who wall off the paint.",
    "Stretch Big": "Bigs who pull centers to the arc.",
    "Playmaking Big": "Hubs who orchestrate from the elbow.",
    Slasher: "Downhill attackers who live at the rim.",
    "Combo Guard": "Flexible guards who score and initiate.",
    Connector: "Glue players who do the little things.",
  };
  return [...map.entries()]
    .map(([role, players]) => ({
      role,
      blurb: blurbs[role] ?? "Versatile contributors.",
      color: ROLE_COLORS[role] ?? "#9aa6b5",
      players: players.sort((a, b) => b.starPower - a.starPower),
    }))
    .sort((a, b) => b.players.length - a.players.length);
}

// ---------------- Underrated Finder ----------------
export interface UnderratedRow {
  player: Player;
  underratedScore: number;
  reasons: string[];
}

export function underratedBoard(maxSalary = 25): UnderratedRow[] {
  return PLAYERS.filter((p) => p.salary <= maxSalary)
    .map((p) => {
      const efficiency = (p.tsp - 0.54) * 140;
      const impact = p.bpm * 4 + p.netRtg * 1.5;
      const cheapness = (25 - p.salary) * 1.1;
      const lowNoise = (22 - p.usg) * 0.7; // low usage = under-the-radar
      const underratedScore = clamp(
        40 + efficiency + impact + cheapness * 0.8 + lowNoise + (p.defImpact - 50) * 0.2,
        0,
        100,
      );
      const reasons: string[] = [];
      if (p.tsp >= 0.58) reasons.push(`elite ${(p.tsp * 100).toFixed(0)}% TS`);
      if (p.bpm >= 3) reasons.push(`+${p.bpm} BPM`);
      if (p.salary <= 12) reasons.push(`only $${p.salary}M`);
      if (p.netRtg >= 4) reasons.push(`+${p.netRtg} on-court net`);
      if (p.usg < 22) reasons.push("low-usage value");
      return { player: p, underratedScore: Math.round(underratedScore), reasons: reasons.slice(0, 3) };
    })
    .sort((a, b) => b.underratedScore - a.underratedScore);
}

// ---------------- Development Curve ----------------
export interface DevPoint {
  age: number;
  proj: number;
  lo: number;
  hi: number;
}
export interface DevResult {
  curve: DevPoint[];
  peakAge: number;
  ceiling: string;
  comp: Player | null;
}

export function developmentCurve(id: string): DevResult | null {
  const p = getPlayer(id);
  if (!p) return null;
  // age curve: rise to ~27, plateau, decline ~31+
  const base = p.per;
  const slope = clamp((30 - p.age) * 0.05, -0.4, 0.9) + (p.starPower > 70 ? 0.2 : 0);
  const curve: DevPoint[] = [];
  for (let a = p.age; a <= Math.min(p.age + 6, 34); a++) {
    const yrs = a - p.age;
    const ageFactor = a <= 27 ? 1 + 0.04 * yrs * slope : 1 - 0.03 * (a - 27);
    const proj = clamp(base * ageFactor + yrs * (p.age < 25 ? 0.8 : 0.1), 8, 38);
    const uncertainty = 1.5 + yrs * 0.9 + (p.age < 24 ? 1.5 : 0);
    curve.push({
      age: a,
      proj: Math.round(proj * 10) / 10,
      lo: Math.round((proj - uncertainty) * 10) / 10,
      hi: Math.round((proj + uncertainty) * 10) / 10,
    });
  }
  const peak = curve.reduce((m, c) => (c.proj > m.proj ? c : m), curve[0]);
  const ceiling =
    p.starPower > 80 ? "Perennial All-NBA" : p.starPower > 65 ? "All-Star upside" : p.starPower > 50 ? "Quality starter" : "Rotation piece";
  const comp =
    PLAYERS.filter((x) => x.id !== id && x.age >= 28 && x.archetype === p.archetype).sort(
      (a, b) => b.starPower - a.starPower,
    )[0] ?? null;
  return { curve, peakAge: peak.age, ceiling, comp };
}

// ---------------- Defensive Impact ----------------
export interface DefRow {
  player: Player;
  rimProtect: number;
  perimeter: number;
  oppFg: number;
  defScore: number;
  grade: string;
}

export function defenseBoard(): DefRow[] {
  return PLAYERS.map((p) => {
    const rimProtect = clamp(p.bpg * 18 + (p.pos === "C" ? 30 : p.pos === "PF" ? 18 : 6) + p.defReb * 1.2, 0, 100);
    const perimeter = clamp(p.spg * 22 + (p.pos === "PG" || p.pos === "SG" ? 22 : 10) + p.netRtg, 0, 100);
    const oppFg = Math.round((47 - p.defImpact * 0.06) * 10) / 10;
    const defScore = clamp(p.defImpact * 0.6 + rimProtect * 0.2 + perimeter * 0.2, 0, 100);
    return {
      player: p,
      rimProtect: Math.round(rimProtect),
      perimeter: Math.round(perimeter),
      oppFg,
      defScore: Math.round(defScore),
      grade: letterGrade(defScore),
    };
  }).sort((a, b) => b.defScore - a.defScore);
}

// ---------------- Injury Risk ----------------
export interface InjuryFactor {
  label: string;
  value: number; // contribution 0-100
  note: string;
}
export interface InjuryResult {
  risk: number;
  band: "Low" | "Moderate" | "Elevated" | "High";
  factors: InjuryFactor[];
  recommendation: string;
}

export function injuryRisk(
  p: Player,
  opts?: { restDays?: number; b2b?: number; minutesLoad?: number },
): InjuryResult {
  const restDays = opts?.restDays ?? 1;
  const b2b = opts?.b2b ?? 14;
  const minutes = opts?.minutesLoad ?? p.mpg;
  const missed = Math.max(0, 82 - p.gp);
  const factors: InjuryFactor[] = [
    { label: "Age", value: clamp((p.age - 24) * 6, 0, 100), note: `${p.age} years old` },
    { label: "Minutes load", value: clamp((minutes - 30) * 5, 0, 100), note: `${minutes.toFixed(0)} MPG` },
    { label: "Games missed", value: clamp(missed * 3.2, 0, 100), note: `${missed} missed last yr` },
    { label: "Back-to-backs", value: clamp(b2b * 4, 0, 100), note: `${b2b} B2Bs` },
    { label: "Rest", value: clamp((2 - restDays) * 28, 0, 100), note: `${restDays} day(s) rest` },
    { label: "Frame load", value: clamp((p.wtLb / p.htIn - 2.7) * 90, 0, 100), note: "body mass index" },
  ];
  // Real inference from the trained injury-risk model (AUC 0.66, 9.5k player-seasons),
  // blended slightly toward short-rest context which the season-level model can't see.
  const modelProb = predictInjuryProb({
    age: p.age,
    mpg: minutes,
    gamesMissedPrev: missed,
    b2bCount: b2b,
    frameIndex: p.wtLb / p.htIn,
  });
  const restBump = (2 - restDays) * 6;
  const risk = clamp(modelProb * 100 * 2.4 + restBump, 4, 97);
  const band = risk < 30 ? "Low" : risk < 50 ? "Moderate" : risk < 70 ? "Elevated" : "High";
  const recommendation =
    band === "High"
      ? "Load-manage aggressively; cap minutes and avoid both ends of B2Bs."
      : band === "Elevated"
        ? "Monitor minutes on B2Bs and short-rest games."
        : band === "Moderate"
          ? "Normal rotation with periodic rest on long road trips."
          : "Durable profile — full availability expected.";
  return { risk: Math.round(risk), band, factors, recommendation };
}

// ---------------- Awards ----------------
export type AwardKind = "MVP" | "DPOY" | "ROTY" | "6MOY";
export interface AwardRow {
  player: Player;
  share: number; // 0-100
  odds: number;
}

export function awardRace(kind: AwardKind): AwardRow[] {
  const teamWins = (abbr: string) => TEAM_MAP[abbr]?.wins ?? 41;
  let scored = PLAYERS.map((p) => {
    const wins = teamWins(p.team);
    let raw = 0;
    if (kind === "MVP")
      raw = predictMvpShare({ per: p.per, bpm: p.bpm, teamWins: wins, ppg: p.ppg, ts: p.tsp });
    else if (kind === "DPOY") raw = p.defImpact * 0.9 + p.bpg * 6 + p.spg * 5 + (wins - 41) * 0.3;
    else if (kind === "ROTY") raw = (p.exp <= 1 ? p.per + p.ppg * 0.6 + p.bpm * 1.5 : -999);
    else raw = (p.salary < 18 && p.usg < 26 ? p.ppg * 1.2 + p.per * 0.5 : -999);
    return { player: p, raw };
  }).filter((x) => x.raw > -100);
  scored.sort((a, b) => b.raw - a.raw);
  const top = scored.slice(0, 8);
  const sum = top.reduce((s, x) => s + Math.max(0, x.raw), 0) || 1;
  return top.map((x) => ({
    player: x.player,
    share: Math.round((Math.max(0, x.raw) / sum) * 100),
    odds: Math.round((Math.max(0, x.raw) / sum) * 100),
  }));
}

// ---------------- Scouting Report ----------------
export interface ScoutReport {
  strengths: string[];
  weaknesses: string[];
  role: string;
  comp: string;
  priorities: string[];
  summary: string;
  grades: { label: string; value: number }[];
}

export function scoutingReport(id: string): ScoutReport | null {
  const p = getPlayer(id);
  if (!p) return null;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (p.tsp >= 0.58) strengths.push(`Elite scoring efficiency (${(p.tsp * 100).toFixed(0)}% TS)`);
  if (p.apg >= 6) strengths.push(`High-level passing (${p.apg} APG)`);
  if (p.shotThree >= 0.4 && p.tpp >= 0.37) strengths.push(`Floor-spacing shooter (${(p.tpp * 100).toFixed(0)}% from three)`);
  if (p.defImpact >= 60) strengths.push("Plus defender with real rim/perimeter value");
  if (p.rpg >= 9) strengths.push(`Strong rebounder (${p.rpg} RPG)`);
  if (p.bpg >= 1.5) strengths.push(`Rim protection (${p.bpg} BPG)`);
  if (p.usg >= 29) strengths.push("Proven high-usage shot creator");
  if (strengths.length < 2) strengths.push("Reliable, low-mistake role player");

  if (p.tpp < 0.34) weaknesses.push(`Inconsistent outside shot (${(p.tpp * 100).toFixed(0)}% 3PT)`);
  if (p.topg >= 3.2) weaknesses.push(`Turnover-prone (${p.topg} TOV)`);
  if (p.defImpact < 45) weaknesses.push("Below-average defensive impact");
  if (p.ftp < 0.75) weaknesses.push(`Shaky free-throw stroke (${(p.ftp * 100).toFixed(0)}%)`);
  if (p.injuryRisk > 60) weaknesses.push("Durability/availability concerns");
  if (weaknesses.length < 1) weaknesses.push("Limited counter when defenses load up");

  const priorities: string[] = [];
  if (p.age < 25) priorities.push("Add functional strength to finish through contact");
  if (p.tpp < 0.36) priorities.push("Tighten and quicken the catch-and-shoot release");
  if (p.defImpact < 55) priorities.push("Improve off-ball defensive discipline and closeouts");
  if (p.apg < 4 && (p.pos === "PG" || p.pos === "SG")) priorities.push("Develop pick-and-roll reads");
  if (priorities.length < 2) priorities.push("Expand shot diet to maintain efficiency at scale");

  const comp =
    PLAYERS.filter((x) => x.id !== id && x.archetype === p.archetype).sort(
      (a, b) => Math.abs(a.starPower - p.starPower) - Math.abs(b.starPower - p.starPower),
    )[0]?.name ?? "unique profile";

  const summary = `${p.name} projects as a ${p.archetype.toLowerCase()} (${p.pos}). At ${p.age}, the profile is built on ${strengths[0]?.toLowerCase() ?? "two-way feel"}, with development hinging on ${priorities[0]?.toLowerCase() ?? "consistency"}.`;

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 4),
    role: p.archetype,
    comp,
    priorities: priorities.slice(0, 4),
    summary,
    grades: [
      { label: "Scoring", value: clamp(p.offImpact, 0, 100) },
      { label: "Shooting", value: clamp((p.tpp - 0.3) * 250 + 30, 0, 100) },
      { label: "Playmaking", value: clamp(p.apg * 8, 0, 100) },
      { label: "Defense", value: clamp(p.defImpact, 0, 100) },
      { label: "Rebounding", value: clamp(p.rpg * 7, 0, 100) },
      { label: "Athleticism", value: clamp(p.starPower * 0.7 + 25, 0, 100) },
    ],
  };
}
