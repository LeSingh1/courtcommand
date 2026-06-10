import type { Player, Position } from "@/lib/types";
import { PLAYERS, getPlayer, TEAM_MAP } from "@/lib/data";
import { letterGrade } from "@/lib/cn";
import { predictMvpShare, predictInjuryProb } from "@/lib/model";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------------- Player Similarity (HoopRadar) ----------------
// Ten stat dimensions, z-scored over the full league pool, then compared with
// cosine similarity over weighted z-vectors. Category weights: scoring .22,
// efficiency .18, playmaking .16, defense .16, shot-diet .16, rebounding .12.
const SIM_DIMS: { key: keyof Player; label: string; weight: number }[] = [
  { key: "ppg", label: "Scoring volume", weight: 0.12 }, // scoring (.22 total)
  { key: "usg", label: "Usage load", weight: 0.1 },
  { key: "apg", label: "Playmaking", weight: 0.16 }, // playmaking
  { key: "rpg", label: "Rebounding", weight: 0.12 }, // rebounding
  { key: "tsp", label: "Efficiency (TS%)", weight: 0.18 }, // efficiency
  { key: "defImpact", label: "Defensive impact", weight: 0.1 }, // defense (.16 total)
  { key: "spg", label: "Steals", weight: 0.03 },
  { key: "bpg", label: "Blocks", weight: 0.03 },
  { key: "shotThree", label: "3PT shot diet", weight: 0.1 }, // shot-diet (.16 total)
  { key: "shotRim", label: "Rim pressure", weight: 0.06 },
];

let _poolStats: { mean: number; sd: number }[] | null = null;
function poolStats(): { mean: number; sd: number }[] {
  if (_poolStats) return _poolStats;
  _poolStats = SIM_DIMS.map((d) => {
    // A handful of derived dims (shot diet) are undefined for players with no
    // recorded shot attempts — normalize over the finite values only.
    const vals = PLAYERS.map((p) => Number(p[d.key])).filter((v) => Number.isFinite(v));
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const sd =
      Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 1;
    return { mean, sd };
  });
  return _poolStats;
}

function zVector(p: Player): number[] {
  const stats = poolStats();
  return SIM_DIMS.map((d, i) => {
    const v = Number(p[d.key]);
    // No data on a dimension → sit at the league mean (z = 0) rather than NaN.
    return Number.isFinite(v) ? (v - stats[i].mean) / stats[i].sd : 0;
  });
}

export type PositionFilter = "same" | "adjacent" | "any";
export type AgeBandFilter = "within3" | "any";

const POS_ORDER: Record<Position, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

function passesPosition(target: Player, p: Player, f: PositionFilter): boolean {
  if (f === "any") return true;
  const d = Math.abs(POS_ORDER[target.pos] - POS_ORDER[p.pos]);
  return f === "same" ? d === 0 : d <= 1;
}

export interface TraitDelta {
  label: string;
  delta: number; // |z(target) - z(comp)| on that dimension
}

export interface SimResult {
  player: Player;
  score: number; // 0-100 similarity
  reasons: string[];
  topSharedTraits: TraitDelta[]; // 3 dims with smallest normalized distance
  biggestDifferences: TraitDelta[]; // 2 dims with largest
  matchedArchetype: string;
}

export function similarPlayers(
  id: string,
  limit = 6,
  opts?: { position?: PositionFilter; ageBand?: AgeBandFilter },
): SimResult[] {
  const target = getPlayer(id);
  if (!target) return [];
  const posFilter = opts?.position ?? "any";
  const ageFilter = opts?.ageBand ?? "any";
  const tz = zVector(target);
  const tw = tz.map((z, i) => z * SIM_DIMS[i].weight);
  const tMag = Math.sqrt(tw.reduce((a, b) => a + b * b, 0)) || 1;

  return PLAYERS.filter(
    (p) =>
      p.id !== id &&
      passesPosition(target, p, posFilter) &&
      (ageFilter === "any" || Math.abs(p.age - target.age) <= 3),
  )
    .map((p) => {
      const pz = zVector(p);
      const pw = pz.map((z, i) => z * SIM_DIMS[i].weight);
      const pMag = Math.sqrt(pw.reduce((a, b) => a + b * b, 0)) || 1;
      let dot = 0;
      for (let i = 0; i < tw.length; i++) dot += tw[i] * pw[i];
      const cos = dot / (tMag * pMag);
      const score = clamp(Math.round(((cos + 1) / 2) * 100), 0, 99);

      const deltas: TraitDelta[] = SIM_DIMS.map((d, i) => ({
        label: d.label,
        delta: Math.round(Math.abs(tz[i] - pz[i]) * 100) / 100,
      }));
      const byCloseness = deltas.slice().sort((a, b) => a.delta - b.delta);

      const reasons: string[] = [];
      if (Math.abs(p.usg - target.usg) < 3) reasons.push("similar usage load");
      if (Math.abs(p.shotThree - target.shotThree) < 0.08) reasons.push("matching shot diet");
      if (Math.abs(p.apg - target.apg) < 1.5) reasons.push("comparable playmaking");
      if (Math.abs(p.defImpact - target.defImpact) < 10) reasons.push("same defensive tier");
      if (p.archetype === target.archetype) reasons.push(`both ${p.archetype.toLowerCase()}s`);

      return {
        player: p,
        score,
        reasons: reasons.slice(0, 3),
        topSharedTraits: byCloseness.slice(0, 3),
        biggestDifferences: byCloseness.slice(-2).reverse(),
        matchedArchetype: p.archetype,
      };
    })
    .sort((a, b) => b.score - a.score || a.player.id.localeCompare(b.player.id))
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
  "Primary Creator": "#4D8DFF",
  "Volume Scorer": "#4D8DFF",
  "Secondary Playmaker": "#D7BC6A",
  "3 and D Wing": "#6B6E78",
  "Floor Spacer": "#6B6E78",
  "Perimeter Stopper": "#4D8DFF",
  "Rim Protector": "#6B6E78",
  "Stretch Big": "#FF9A45",
  "Playmaking Big": "#D7BC6A",
  Slasher: "#F4647D",
  "Combo Guard": "#4D8DFF",
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

// Per-player role read: every role template is scored 0-100 from real
// per-game stats; the gap between the top two scores (normalized by the top
// score) is the confidence that the primary role is the right call.
export interface RoleScore {
  role: string;
  score: number;
}

export interface RoleClassification {
  player: Player;
  role: string;
  color: string;
  scores: RoleScore[]; // all roles, sorted desc
  secondaryRoles: RoleScore[]; // next 2 by score
  confidence: number; // 0-100 normalized gap between top-1 and top-2
  matchedTraits: string[]; // threshold rules that fired for the primary role
  similarArchetypePlayers: Player[]; // 3 same-role players by closest starPower
}

interface RoleDef {
  role: string;
  score: (p: Player) => number;
  rules: { when: (p: Player) => boolean; text: (p: Player) => string }[];
}

const isBig = (p: Player) => p.pos === "C" || p.pos === "PF";
const isGuard = (p: Player) => p.pos === "PG" || p.pos === "SG";
// Three-point accuracy only counts toward spacing roles when the volume backs
// it up: a 75% mark on 1.6 attempts a game is small-sample noise, not a skill.
const spacingGate = (p: Player) =>
  clamp((p.shotThree - 0.2) / 0.2, 0, 1) * clamp(p.tpa / 4, 0, 1);

const ROLE_DEFS: RoleDef[] = [
  {
    role: "Rim Protector",
    score: (p) =>
      clamp(
        p.bpg * 28 + (p.pos === "C" ? 22 : p.pos === "PF" ? 12 : 0) + p.defReb * 2.2 - p.shotThree * 30,
        0,
        100,
      ),
    rules: [
      { when: (p) => p.bpg >= 1.3, text: (p) => `${p.bpg} BPG clears the rim-protector bar (1.3)` },
      { when: (p) => isBig(p), text: (p) => `${p.pos} frame anchors the paint` },
      { when: (p) => p.defReb >= 6, text: (p) => `${p.defReb} defensive boards per game end possessions` },
      {
        when: (p) => p.shotThree <= 0.2,
        text: (p) => `interior shot diet (${Math.round(p.shotThree * 100)}% of FGA from three)`,
      },
    ],
  },
  {
    role: "Primary Creator",
    score: (p) => clamp(p.apg * 7 + (p.usg - 18) * 2.2, 0, 100),
    rules: [
      { when: (p) => p.apg >= 7, text: (p) => `runs the offense at ${p.apg} APG` },
      { when: (p) => p.usg >= 26, text: (p) => `carries a ${p.usg}% usage load` },
    ],
  },
  {
    role: "Volume Scorer",
    score: (p) => clamp((p.ppg - 8) * 3 + (p.usg - 18) * 2, 0, 100),
    rules: [
      { when: (p) => p.ppg >= 24, text: (p) => `${p.ppg} PPG scoring volume` },
      { when: (p) => p.usg >= 29, text: (p) => `top-shelf ${p.usg}% usage` },
    ],
  },
  {
    role: "Secondary Playmaker",
    score: (p) => clamp(p.apg * 9 - Math.max(0, p.usg - 24) * 3, 0, 100),
    rules: [
      { when: (p) => p.apg >= 5, text: (p) => `${p.apg} APG of connective passing` },
      { when: (p) => p.usg < 26, text: (p) => `creates without dominating the ball (${p.usg}% usage)` },
    ],
  },
  {
    role: "3 and D Wing",
    score: (p) =>
      clamp(
        p.shotThree * 55 +
          (p.tpp - 0.3) * 200 * spacingGate(p) +
          (p.defImpact - 40) * 0.9 +
          (p.pos === "SF" || p.pos === "SG" ? 8 : 0),
        0,
        100,
      ),
    rules: [
      {
        when: (p) => p.shotThree >= 0.45,
        text: (p) => `${Math.round(p.shotThree * 100)}% of attempts from deep`,
      },
      {
        when: (p) => p.tpp >= 0.36 && p.tpa >= 4,
        text: (p) => `${(p.tpp * 100).toFixed(1)}% on ${p.tpa} 3PA/g`,
      },
      { when: (p) => p.defImpact >= 45, text: (p) => `defensive impact ${p.defImpact}/100` },
    ],
  },
  {
    role: "Floor Spacer",
    score: (p) => clamp(p.shotThree * 65 + (p.tpp - 0.3) * 260 * spacingGate(p), 0, 100),
    rules: [
      {
        when: (p) => p.shotThree >= 0.45,
        text: (p) => `${Math.round(p.shotThree * 100)}% of attempts from deep`,
      },
      {
        when: (p) => p.tpp >= 0.37 && p.tpa >= 4,
        text: (p) => `${(p.tpp * 100).toFixed(1)}% on ${p.tpa} 3PA/g`,
      },
    ],
  },
  {
    role: "Perimeter Stopper",
    score: (p) =>
      clamp(p.spg * 24 + (p.defImpact - 40) * 1.1 + (isGuard(p) || p.pos === "SF" ? 8 : 0), 0, 100),
    rules: [
      { when: (p) => p.spg >= 1.4, text: (p) => `${p.spg} SPG of ball pressure` },
      { when: (p) => p.defImpact >= 50, text: (p) => `defensive impact ${p.defImpact}/100` },
    ],
  },
  {
    role: "Stretch Big",
    score: (p) =>
      isBig(p)
        ? clamp(p.shotThree * 95 + (p.tpp - 0.3) * 220 * spacingGate(p) + p.rpg * 1.2, 0, 100)
        : 0,
    rules: [
      { when: (p) => isBig(p), text: (p) => `${p.pos} who pulls his man to the arc` },
      {
        when: (p) => p.shotThree > 0.3,
        text: (p) => `${Math.round(p.shotThree * 100)}% of attempts from three`,
      },
      {
        when: (p) => p.tpp >= 0.36 && p.tpa >= 3,
        text: (p) => `${(p.tpp * 100).toFixed(1)}% on ${p.tpa} 3PA/g`,
      },
    ],
  },
  {
    role: "Playmaking Big",
    score: (p) => (isBig(p) ? clamp(p.apg * 11 + p.rpg * 1.4, 0, 100) : 0),
    rules: [
      { when: (p) => isBig(p), text: (p) => `${p.pos} operating as an offensive hub` },
      { when: (p) => p.apg >= 4, text: (p) => `${p.apg} APG from the elbow` },
    ],
  },
  {
    role: "Slasher",
    score: (p) => clamp(p.shotRim * 70 + (p.ppg - 8) * 1.7, 0, 100),
    rules: [
      {
        when: (p) => p.shotRim >= 0.4,
        text: (p) => `${Math.round(p.shotRim * 100)}% of attempts at the rim`,
      },
      { when: (p) => p.ppg >= 18, text: (p) => `${p.ppg} PPG of downhill scoring` },
    ],
  },
  {
    role: "Combo Guard",
    score: (p) => (isGuard(p) ? clamp(p.ppg * 1.5 + p.apg * 3.5 + 10, 0, 100) : 0),
    rules: [
      { when: (p) => isGuard(p), text: (p) => `${p.pos} who toggles on/off ball` },
      {
        when: (p) => p.ppg >= 12 && p.apg >= 3,
        text: (p) => `balanced ${p.ppg} PPG / ${p.apg} APG line`,
      },
    ],
  },
  {
    role: "Connector",
    score: (p) => clamp(50 - (p.usg - 15) * 1.8 + p.bpm * 2 + p.spg * 5, 0, 100),
    rules: [
      { when: (p) => p.usg < 20, text: (p) => `low-maintenance ${p.usg}% usage` },
      { when: (p) => p.bpm > 0, text: (p) => `positive impact metrics (+${p.bpm} BPM)` },
    ],
  },
];

export function classifyRole(id: string): RoleClassification | null {
  const p = getPlayer(id);
  if (!p) return null;
  const scores: RoleScore[] = ROLE_DEFS.map((d) => ({
    role: d.role,
    score: Math.round(clamp(d.score(p), 0, 100)),
  })).sort((a, b) => b.score - a.score || a.role.localeCompare(b.role));
  const top = scores[0];
  const second = scores[1];
  const confidence = Math.round(clamp(((top.score - second.score) / Math.max(top.score, 1)) * 100, 0, 100));
  const def = ROLE_DEFS.find((d) => d.role === top.role)!;
  const fired = def.rules.filter((r) => r.when(p)).map((r) => r.text(p));
  const matchedTraits = fired.length
    ? fired
    : [`closest statistical template at ${top.score}/100 (no single threshold dominates)`];
  let pool = PLAYERS.filter((x) => x.id !== p.id && x.archetype === top.role);
  if (pool.length < 3) {
    const ids = new Set(pool.map((x) => x.id));
    pool = pool.concat(PLAYERS.filter((x) => x.id !== p.id && x.pos === p.pos && !ids.has(x.id)));
  }
  const similarArchetypePlayers = pool
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.starPower - p.starPower) - Math.abs(b.starPower - p.starPower) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 3);
  return {
    player: p,
    role: top.role,
    color: ROLE_COLORS[top.role] ?? "#9aa6b5",
    scores,
    secondaryRoles: scores.slice(1, 3),
    confidence,
    matchedTraits,
    similarArchetypePlayers,
  };
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
    else if (kind === "DPOY")
      // DPOY rewards individual defense (rim protection + events), not team
      // record — a dominant anchor on a losing team can still run away with it.
      raw = p.defImpact * 1.4 + p.bpg * 9 + p.spg * 4 + p.rpg * 0.4 + Math.max(0, wins - 45) * 0.12;
    else if (kind === "ROTY") raw = (p.exp <= 1 ? p.per + p.ppg * 0.6 + p.bpm * 1.5 : -999);
    else raw = (p.salary < 18 && p.usg < 26 ? p.ppg * 1.2 + p.per * 0.5 : -999);
    return { player: p, raw };
  }).filter((x) => x.raw > -100);
  scored.sort((a, b) => b.raw - a.raw);
  const top = scored.slice(0, 8);
  // Real award voting concentrates on the frontrunner — it is not a linear
  // split of a raw score. Convert raw scores to z-scores within the candidate
  // field, then softmax: a clear favorite pulls away, a genuine toss-up stays
  // tight. Temperature T controls how sharply the leader separates.
  const raws = top.map((x) => x.raw);
  const mean = raws.reduce((a, b) => a + b, 0) / raws.length;
  const std = Math.sqrt(raws.reduce((a, b) => a + (b - mean) ** 2, 0) / raws.length) || 1;
  const T = 0.72;
  const exps = top.map((x) => Math.exp((x.raw - mean) / std / T));
  const z = exps.reduce((a, b) => a + b, 0) || 1;
  const shares = exps.map((e) => (e / z) * 100);
  // round to whole percents but keep the total at 100
  const rounded = shares.map((s) => Math.round(s));
  const drift = 100 - rounded.reduce((a, b) => a + b, 0);
  if (rounded.length) rounded[0] += drift;
  return top.map((x, i) => ({ player: x.player, share: rounded[i], odds: rounded[i] }));
}

// ---------------- Scouting Report ----------------
export interface ScoutReport {
  strengths: string[];
  weaknesses: string[];
  role: string;
  comp: string;
  priorities: string[]; // alias of developmentPriorities (kept for existing callers)
  developmentPriorities: string[]; // 3 items from the player's weakest z-scored dimensions
  riskFactors: string[]; // age / availability / efficiency-based flags
  summary: string;
  grades: { label: string; value: number }[];
}

// Development prescriptions keyed by the z-scored similarity dimensions.
// usg is excluded — a low usage rate is a role decision, not a skill gap.
const PRIORITY_TEXT: Partial<Record<string, (p: Player, z: string) => string>> = {
  ppg: (p, z) => `Scoring volume: ${p.ppg} PPG (z ${z}) — manufacture easier points off cuts and transition`,
  apg: (p, z) => `Playmaking: ${p.apg} APG (z ${z}) — develop pick-and-roll reads and kickout passing`,
  rpg: (p, z) => `Rebounding: ${p.rpg} RPG (z ${z}) — improve box-out positioning and pursuit`,
  tsp: (p, z) => `Efficiency: ${(p.tsp * 100).toFixed(1)}% TS (z ${z}) — trim long twos, raise rim and FT volume`,
  defImpact: (p, z) => `Defense: impact ${p.defImpact}/100 (z ${z}) — sharpen closeouts and off-ball discipline`,
  spg: (p, z) => `Ball pressure: ${p.spg} SPG (z ${z}) — generate more deflections and events`,
  bpg: (p, z) => `Rim deterrence: ${p.bpg} BPG (z ${z}) — improve verticality and contest timing`,
  shotThree: (p, z) =>
    `Shot diet: ${Math.round(p.shotThree * 100)}% of FGA from three (z ${z}) — expand catch-and-shoot range`,
  shotRim: (p, z) =>
    `Rim pressure: ${Math.round(p.shotRim * 100)}% of FGA at the rim (z ${z}) — attack closeouts, get downhill`,
};

function developmentPrioritiesFor(p: Player): string[] {
  const stats = poolStats();
  return SIM_DIMS.map((d, i) => ({
    key: String(d.key),
    z: (Number(p[d.key]) - stats[i].mean) / stats[i].sd,
  }))
    .filter((d) => PRIORITY_TEXT[d.key])
    .sort((a, b) => a.z - b.z)
    .slice(0, 3)
    .map((d) => {
      const zStr = `${d.z >= 0 ? "+" : "−"}${Math.abs(d.z).toFixed(1)}`;
      return PRIORITY_TEXT[d.key]!(p, zStr);
    });
}

function riskFactorsFor(p: Player): string[] {
  const out: string[] = [];
  const missed = Math.max(0, 82 - p.gp);
  const poolTs = poolStats()[SIM_DIMS.findIndex((d) => d.key === "tsp")];
  if (p.age >= 33) out.push(`Age ${p.age} — on the wrong side of the historical aging curve`);
  else if (p.age >= 30) out.push(`Age ${p.age} — entering the decline phase of the age curve`);
  if (missed >= 15) out.push(`Availability — missed ${missed} games last season`);
  if (p.injuryRisk >= 60) out.push(`Injury-risk composite ${p.injuryRisk}/100 (age, minutes, frame load)`);
  if (p.tsp < poolTs.mean - 0.5 * poolTs.sd)
    out.push(
      `Efficiency — ${(p.tsp * 100).toFixed(1)}% TS runs below the league band (${(poolTs.mean * 100).toFixed(1)}% avg)`,
    );
  if (p.mpg >= 36) out.push(`Workload — ${p.mpg} MPG is a heavy nightly minutes load`);
  if (!out.length)
    out.push(
      `No major red flags — age ${p.age}, ${p.gp} GP and ${(p.tsp * 100).toFixed(1)}% TS all sit in healthy bands`,
    );
  return out;
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

  const priorities = developmentPrioritiesFor(p);
  const riskFactors = riskFactorsFor(p);

  const comp =
    PLAYERS.filter((x) => x.id !== id && x.archetype === p.archetype).sort(
      (a, b) => Math.abs(a.starPower - p.starPower) - Math.abs(b.starPower - p.starPower),
    )[0]?.name ?? "unique profile";

  const summary = `${p.name} projects as a ${p.archetype.toLowerCase()} (${p.pos}). At ${p.age}, the profile is built on ${strengths[0]?.toLowerCase() ?? "two-way feel"}, with development hinging on ${priorities[0]?.split(":")[0].toLowerCase() ?? "consistency"}.`;

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 4),
    role: p.archetype,
    comp,
    priorities,
    developmentPriorities: priorities,
    riskFactors,
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
