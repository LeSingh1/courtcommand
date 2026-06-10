import type { Player } from "@/lib/types";
import { PLAYERS, TEAMS } from "@/lib/data";
import type { Team } from "@/lib/types";

// Deterministic value/risk/projection helpers. Every number here is a pure
// function of the real ingested season stats — no randomness anywhere.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------- Shared composites ----------------

// Two-way production index, 0-100. Blends scoring/playmaking impact, defensive
// impact, and box plus-minus so one number can be priced against salary.
export function productionComposite(p: Player): number {
  return r1(clamp(p.offImpact * 0.5 + p.defImpact * 0.3 + p.bpm * 2 + 10, 0, 100));
}

// Age-curve multiplier with peak at 27: a premium for years of growth still
// ahead, a discount per year past the peak.
export function ageCurveFactor(age: number): number {
  if (age <= 27) return r2(clamp(1 + (27 - age) * 0.015, 0.85, 1.12));
  return r2(clamp(1 - (age - 27) * 0.022, 0.72, 1));
}

// ---------------- 13: Contract Value breakdown ----------------

export interface ContractBreakdown {
  production: number; // two-way composite, 0-100
  productionPerDollar: number; // composite points per $M of salary
  ageCurveFactor: number;
  availability: { factor: number; note: string };
  bargainScore: number; // 0-100
  contractRisk: { level: "Low" | "Med" | "High"; why: string };
}

export function contractBreakdown(p: Player): ContractBreakdown {
  const production = productionComposite(p);
  // Salary floor keeps min-deal division honest (vet minimum ~$2M).
  const productionPerDollar = r2(production / Math.max(2, p.salary));
  const ageFactor = ageCurveFactor(p.age);

  const availFactor = r2(clamp(p.gp / 72, 0.4, 1.04));
  const missed = Math.max(0, 82 - p.gp);
  const availNote =
    p.gp >= 70
      ? `Iron-man availability — ${p.gp} of 82 games`
      : p.gp >= 58
        ? `Reliable availability — ${p.gp} games played`
        : p.gp >= 45
          ? `Moderate availability — missed ${missed} games`
          : `Limited sample — only ${p.gp} games played`;

  // Bargain score: per-dollar efficiency plus absolute production, gated so
  // empty-calorie minimum deals don't float to the top, then shaped by the
  // age curve and availability.
  const productionGate = clamp(production / 45, 0, 1);
  const raw = (productionPerDollar * 6 + production * 0.35) * productionGate;
  const bargainScore = Math.round(clamp(raw * ageFactor * availFactor, 0, 100));

  const declining = p.age >= 31;
  const fragileSample = availFactor < 0.75;
  let level: ContractBreakdown["contractRisk"]["level"];
  const whys: string[] = [];
  if (p.salary >= 30 && (declining || fragileSample || production < 45)) {
    level = "High";
    if (declining) whys.push(`$${p.salary}M committed into the post-27 decline (age ${p.age})`);
    if (fragileSample) whys.push(`only ${p.gp} games behind the price tag`);
    if (production < 45) whys.push("production already trails the price point");
  } else if (p.salary >= 18 && (declining || fragileSample || bargainScore < 35)) {
    level = "Med";
    if (declining) whys.push(`age ${p.age} puts the deal on the wrong side of the curve`);
    if (fragileSample) whys.push(`${missed} missed games thin the evidence`);
    if (bargainScore < 35) whys.push("mid-size money for replacement-level surplus");
  } else if (p.salary < 12) {
    level = "Low";
    whys.push(`$${p.salary}M is small enough that the downside is capped`);
  } else {
    level = bargainScore >= 45 ? "Low" : "Med";
    whys.push(
      bargainScore >= 45
        ? "production comfortably covers the salary slot"
        : "fair money, but little surplus if production dips",
    );
  }

  return {
    production,
    productionPerDollar,
    ageCurveFactor: ageFactor,
    availability: { factor: availFactor, note: availNote },
    bargainScore,
    contractRisk: { level, why: whys.join("; ") },
  };
}

// ---------------- 30: Underrated profile ----------------

// Players at or above this usage are featured options by definition — they
// cannot be "underrated" and are excluded structurally.
export const UNDERRATED_USAGE_CAP = 27;

export interface TeamFit {
  team: Team;
  fitScore: number; // 0-100
  reasons: string[];
}

export interface UnderratedProfile {
  eligible: boolean;
  whyUnderrated: string[];
  idealTeamFits: TeamFit[];
  riskFactors: string[];
  smallSample: boolean;
  attentionGap: number; // production composite minus star power
}

interface TeamNeed {
  abbr: string;
  threesPerGame: number; // roster-wide made threes per game
  defComposite: number; // minutes-weighted defensive impact
  shootingNeed: number; // 0-100, higher = thinner shooting
  defenseNeed: number; // 0-100, higher = weaker defense
}

let teamNeedsCache: TeamNeed[] | null = null;

function teamNeeds(): TeamNeed[] {
  if (teamNeedsCache) return teamNeedsCache;
  const rows = TEAMS.map((t) => {
    const roster = PLAYERS.filter((p) => p.team === t.abbr);
    const threes = roster.reduce((a, p) => a + p.tpa * p.tpp, 0);
    const minutes = roster.reduce((a, p) => a + p.mpg, 0);
    const def = roster.reduce((a, p) => a + p.defImpact * p.mpg, 0) / Math.max(1, minutes);
    return { abbr: t.abbr, threes, def };
  });
  const tLo = Math.min(...rows.map((x) => x.threes));
  const tHi = Math.max(...rows.map((x) => x.threes));
  const dLo = Math.min(...rows.map((x) => x.def));
  const dHi = Math.max(...rows.map((x) => x.def));
  teamNeedsCache = rows.map((x) => ({
    abbr: x.abbr,
    threesPerGame: r1(x.threes),
    defComposite: r1(x.def),
    shootingNeed: Math.round(((tHi - x.threes) / Math.max(0.01, tHi - tLo)) * 100),
    defenseNeed: Math.round(((dHi - x.def) / Math.max(0.01, dHi - dLo)) * 100),
  }));
  return teamNeedsCache;
}

export function underratedWhy(p: Player): UnderratedProfile {
  const production = productionComposite(p);
  const attentionGap = r1(production - p.starPower);
  const smallSample = p.gp < 45 || p.mpg < 20;

  if (p.usg >= UNDERRATED_USAGE_CAP) {
    return {
      eligible: false,
      whyUnderrated: [],
      idealTeamFits: [],
      riskFactors: [
        `${p.usg}% usage — a featured option by definition, excluded by the ${UNDERRATED_USAGE_CAP}% usage cap`,
      ],
      smallSample,
      attentionGap,
    };
  }

  const why: string[] = [];
  if (p.usg < 22 && p.tsp >= 0.58)
    why.push(`low usage, high efficiency — ${(p.tsp * 100).toFixed(0)}% TS on ${p.usg}% usage`);
  if (p.salary <= 15) why.push(`cheap salary at $${p.salary}M`);
  if (p.defImpact >= 55) why.push(`real defensive impact (${Math.round(p.defImpact)}/100)`);
  if (attentionGap >= 8)
    why.push(`production outruns name recognition (+${attentionGap} vs star-power index)`);
  if (p.netRtg >= 3) why.push(`+${p.netRtg} on-court net rating`);
  if (why.length === 0 && p.bpm >= 1) why.push(`quietly positive impact (+${p.bpm} BPM)`);

  // Fit: shooters route to thin-shooting rosters, defenders to weak defenses.
  const shooter = clamp((p.tpp - 0.3) * 250, 0, 100) * clamp(p.shotThree / 0.5, 0, 1);
  const defender = clamp(p.defImpact, 0, 100);
  const weightSum = Math.max(1, shooter + defender);
  const fits: TeamFit[] = teamNeeds()
    .filter((t) => t.abbr !== p.team)
    .map((t) => {
      const fitScore = Math.round(
        (t.shootingNeed * shooter + t.defenseNeed * defender) / weightSum,
      );
      const reasons: string[] = [];
      if (t.shootingNeed >= 55 && shooter >= 40)
        reasons.push(
          `thin roster shooting (${t.threesPerGame} 3PM/g) meets his ${(p.tpp * 100).toFixed(0)}% stroke`,
        );
      if (t.defenseNeed >= 55 && defender >= 50)
        reasons.push(`weak defensive base (${t.defComposite}/100) gets a real upgrade`);
      if (reasons.length === 0) reasons.push("balanced two-way fit for the rotation");
      return { team: TEAMS.find((x) => x.abbr === t.abbr)!, fitScore, reasons };
    })
    .sort((a, b) => b.fitScore - a.fitScore || a.team.abbr.localeCompare(b.team.abbr))
    .slice(0, 3);

  const risks: string[] = [];
  if (p.gp < 45) risks.push(`small sample — only ${p.gp} games played`);
  if (p.mpg < 20) risks.push(`low minutes (${p.mpg} MPG) — production may not scale with role`);
  if (p.age >= 31) risks.push(`age ${p.age} — the value window is closing`);
  if (p.topg > 0 && p.apg / p.topg < 1.3 && p.apg >= 2)
    risks.push("loose handle for a bigger creation role");
  if (p.tpp < 0.33) risks.push(`defenses can sag off the ${(p.tpp * 100).toFixed(0)}% outside shot`);
  if (risks.length === 0) risks.push("no structural red flags at this price");

  return {
    eligible: true,
    whyUnderrated: why.slice(0, 4),
    idealTeamFits: fits,
    riskFactors: risks.slice(0, 3),
    smallSample,
    attentionGap,
  };
}

// ---------------- 9: Workload risk ----------------

export interface WorkloadRisk {
  workloadScore: number; // 0-100, minutes vs age-adjusted threshold
  ageFactor: number; // 0-100
  recentSpike: number; // 0-100, usage vs what the minutes role implies
  missedGamesFactor: number; // 0-100, from games played
  overall: "low" | "med" | "high";
  contributingFactors: string[];
  recommendations: string[];
}

// Workload assessment from schedule-visible inputs only (minutes, age, games
// played, usage). This is load accounting, not anything medical.
export function workloadRisk(p: Player): WorkloadRisk {
  // Sustainable-minutes threshold drops as players age past 28 and again past 33.
  const threshold = 36 - Math.max(0, p.age - 28) * 0.5 - Math.max(0, p.age - 33) * 0.5;
  const workloadScore = Math.round(clamp(50 + (p.mpg - threshold) * 6, 0, 100));

  const ageFactor = Math.round(clamp((p.age - 23) * 4.5, 0, 100));

  // Usage a role of this size usually carries; running well above it means
  // every minute is heavier than the raw MPG suggests.
  const roleUsage = 14 + p.mpg * 0.28;
  const recentSpike = Math.round(clamp((p.usg - roleUsage) * 7 + 20, 0, 100));

  const missed = Math.max(0, 82 - p.gp);
  const missedGamesFactor = Math.round(clamp(missed * 2.2, 0, 100));

  const composite =
    workloadScore * 0.34 + ageFactor * 0.22 + missedGamesFactor * 0.28 + recentSpike * 0.16;
  const overall: WorkloadRisk["overall"] = composite < 38 ? "low" : composite < 62 ? "med" : "high";

  const factors: string[] = [];
  if (workloadScore >= 55)
    factors.push(`${p.mpg} MPG against an age-${p.age} sustainable line of ${r1(threshold)}`);
  if (ageFactor >= 50) factors.push(`age ${p.age} — recovery windows matter more each season`);
  if (missedGamesFactor >= 50) factors.push(`logged ${p.gp} of 82 games last season`);
  if (recentSpike >= 55)
    factors.push(`${p.usg}% usage runs above the ~${r1(roleUsage)}% typical for this minutes role`);
  if (factors.length === 0) factors.push("minutes, age, and availability all inside normal bands");

  const recommendations =
    overall === "high"
      ? [
          "Monitor workload week to week",
          "Stagger back-to-backs — sit one end",
          "Pre-plan rest nights on long road trips",
        ]
      : overall === "med"
        ? [
            "Monitor workload across compressed stretches",
            "Trim fourth-quarter minutes in decided games",
          ]
        : ["No workload flags — run the standard rotation", "Keep routine maintenance days in place"];

  return {
    workloadScore,
    ageFactor,
    recentSpike,
    missedGamesFactor,
    overall,
    contributingFactors: factors,
    recommendations,
  };
}

// ---------------- 17: Multi-season projection ----------------

export interface SeasonProjection {
  season: number; // years from now, 1-based
  age: number;
  expected: { ppg: number; composite: number };
  best: { ppg: number; composite: number };
  worst: { ppg: number; composite: number };
}

export interface DevelopmentProjection {
  seasons: SeasonProjection[];
  comparablePlayers: Player[];
  growthDrivers: string[];
  riskFactors: string[];
}

export function projectSeasons(p: Player, n = 3): DevelopmentProjection {
  const seasons: SeasonProjection[] = [];
  // Efficiency trend proxy: scoring at high true shooting compounds; empty
  // volume regresses. Role expansion: young players short of starter minutes
  // still have a minutes runway.
  const effTrend = clamp((p.tsp - 0.54) * 0.5, -0.035, 0.05);
  const roleExpansion = p.age <= 24 && p.mpg < 32 ? 0.025 : p.age <= 26 && p.usg < 22 ? 0.012 : 0;

  let expPpg = p.ppg;
  let expComp = clamp(productionComposite(p), 5, 88);
  for (let yr = 1; yr <= n; yr++) {
    const age = p.age + yr;
    const ageGrowth = age <= 27 ? (27 - age + 1) * 0.02 : -(age - 27) * 0.02;
    const g = clamp(ageGrowth + effTrend + roleExpansion, -0.15, 0.14);
    expPpg = Math.max(2, expPpg * (1 + g));
    expComp = clamp(expComp * (1 + g * 0.7), 5, 88);
    // Uncertainty widens with horizon and with youth.
    const spread = 0.07 + yr * 0.035 + (p.age <= 22 ? 0.04 : 0);
    seasons.push({
      season: yr,
      age,
      expected: { ppg: r1(expPpg), composite: r1(expComp) },
      best: { ppg: r1(expPpg * (1 + spread)), composite: r1(Math.min(100, expComp * (1 + spread))) },
      worst: { ppg: r1(Math.max(1, expPpg * (1 - spread))), composite: r1(expComp * (1 - spread)) },
    });
  }

  // Comparables: same archetype further along the same age path; widen to
  // position, then to the whole pool, keeping the closest star-power match.
  const older = (x: Player) => x.id !== p.id && x.age >= p.age + 2;
  let pool = PLAYERS.filter((x) => older(x) && x.archetype === p.archetype);
  if (pool.length < 3) pool = PLAYERS.filter((x) => older(x) && x.pos === p.pos);
  if (pool.length < 3) pool = PLAYERS.filter((x) => x.id !== p.id && x.archetype === p.archetype);
  if (pool.length < 3) pool = PLAYERS.filter((x) => x.id !== p.id);
  const comparablePlayers = [...pool]
    .sort(
      (a, b) =>
        Math.abs(a.starPower - p.starPower) - Math.abs(b.starPower - p.starPower) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 3);

  const growthDrivers: string[] = [];
  if (p.age < 25) growthDrivers.push(`prime years still ahead — ${27 - p.age} seasons to peak age 27`);
  if (p.tsp >= 0.58) growthDrivers.push(`efficiency already at scale (${(p.tsp * 100).toFixed(0)}% TS)`);
  if (p.mpg < 30 && p.per >= 15) growthDrivers.push(`minutes runway — only ${p.mpg} MPG today`);
  if (p.exp <= 3) growthDrivers.push("early-career skills still compounding");
  if (growthDrivers.length === 0) growthDrivers.push("established baseline — gains come from refinement");

  const riskFactors: string[] = [];
  if (p.age >= 30) riskFactors.push(`age ${p.age} — already on the back side of the curve`);
  if (p.gp < 55) riskFactors.push(`only ${p.gp} games — availability shapes every projection`);
  if (p.usg >= 30) riskFactors.push("usage is maxed — growth must come from efficiency, not volume");
  if (p.tpp < 0.33) riskFactors.push(`the ${(p.tpp * 100).toFixed(0)}% outside shot has to develop`);
  if (riskFactors.length === 0) riskFactors.push("normal variance band — no structural flags");

  return { seasons, comparablePlayers, growthDrivers, riskFactors };
}

// ---------------- 28: Defensive profile (radar) ----------------

export const DEFENSE_AXES = ["RIM", "PERIM", "REB", "DISC", "VERS"];

export interface DefensiveProfile {
  axes: string[];
  values: number[]; // 0-100, aligned to axes
  subs: {
    rimProtection: number;
    perimeter: number;
    rebounding: number;
    discipline: number;
    versatility: number;
  };
  matchupNote: string;
}

export function defensiveProfile(p: Player): DefensiveProfile {
  // Rim protection: blocks plus a height/position proxy plus defensive boards.
  const rimProtection = Math.round(
    clamp(
      p.bpg * 24 +
        (p.htIn - 75) * 2.6 +
        (p.pos === "C" ? 12 : p.pos === "PF" ? 7 : 0) +
        p.defReb * 1.5,
      0,
      100,
    ),
  );
  // Perimeter: steals, guard/wing positioning, and on-court swing.
  const perimeter = Math.round(
    clamp(
      p.spg * 30 +
        (p.pos === "PG" || p.pos === "SG" ? 14 : p.pos === "SF" ? 9 : 2) +
        clamp(p.netRtg, -8, 8) * 0.8 +
        (p.mpg >= 28 ? 6 : 0),
      0,
      100,
    ),
  );
  const rebounding = Math.round(clamp(p.rpg * 7.2 + p.defReb * 2, 0, 100));
  // Discipline: no per-game foul data in the ingest, so this is an inverse
  // foul proxy — sustaining heavy minutes with few turnovers means staying
  // out of foul trouble and keeping position.
  const discipline = Math.round(clamp(p.mpg * 1.7 + (3.4 - p.topg) * 9 + p.exp * 1.1, 0, 100));
  // Versatility: position-adjusted — capped by the weaker of rim/perimeter,
  // boosted for wings and event creation at both levels.
  const versatility = Math.round(
    clamp(
      Math.min(rimProtection, perimeter) * 0.85 +
        (p.pos === "SF" || p.pos === "PF" ? 12 : 5) +
        p.spg * 5 +
        p.bpg * 5,
      0,
      100,
    ),
  );

  const gap = rimProtection - perimeter;
  const matchupNote =
    gap >= 25
      ? `Anchor him in drop coverage — elite at the rim, but offenses will hunt him in space on switches.`
      : gap <= -25
        ? `Point-of-attack stopper — keep him on the ball; screen-heavy bigs inside are the counter.`
        : Math.min(rimProtection, perimeter) >= 55
          ? `Switchable across matchups — comfortable guarding up and down the positional ladder.`
          : `Scheme-dependent defender — hide him on low-usage off-ball assignments.`;

  return {
    axes: DEFENSE_AXES,
    values: [rimProtection, perimeter, rebounding, discipline, versatility],
    subs: { rimProtection, perimeter, rebounding, discipline, versatility },
    matchupNote,
  };
}
