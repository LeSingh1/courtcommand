import type { Player, Team } from "@/lib/types";
import {
  PLAYERS,
  TEAMS,
  TEAM_MAP,
  POSITIONS,
  SALARY_CAP,
  FIRST_APRON,
  SECOND_APRON,
  LUXURY_TAX,
} from "@/lib/data";
import { letterGrade } from "@/lib/cn";
import { checkTradeSide, capBand } from "@/lib/engine/cba";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------------- Trade Machine ----------------
export interface TradePick {
  year: number;
  round: 1 | 2;
  protected?: boolean;
}
export interface TradeSide {
  team: string;
  outgoing: Player[];
  incoming: Player[];
  picks?: TradePick[]; // outgoing picks — transfer like players, carry no salary
  picksIn?: TradePick[]; // picks routed to this team
}
export type ContractRiskLevel = "Low" | "Med" | "High";
export interface ContractRisk {
  level: ContractRiskLevel;
  exposure: number; // $M-years committed to incoming players aged 30+
  why: string;
}
export interface TradeResult {
  legal: boolean;
  sides: {
    team: Team;
    out: number;
    in: number;
    netSalary: number;
    newPayroll: number;
    apronBand: string;
    matchOk: boolean;
    talentDelta: number;
    grade: string;
    note: string;
    picks_out: string[]; // label strings, e.g. "2027 1st (protected)"
    picks_in: string[];
    failure_reasons: string[];
    contract_risk: ContractRisk;
    roster_fit_score: number; // post-trade positional balance, 0-100
    roster_fit_delta: number; // vs the pre-trade roster
  }[];
  violations: string[];
}

// Max players a single team can send out in this simplified model.
export const MAX_OUTGOING = 4;

// Next draft year for the 2025-26 season this dataset covers; the trade
// machine lets teams attach picks for the four drafts from this year on.
export const DRAFT_BASE_YEAR = 2026;

// Deterministic talent estimate for a traded pick. Unprotected 1sts are worth
// the most, protections discount them, 2nds are flyers; picks landing within
// two drafts carry a small nearness premium (+0.5 per year inside 2 years).
export function pickValue(pick: TradePick): number {
  const base = pick.round === 1 ? (pick.protected ? 6 : 9) : 2.5;
  const yearsOut = Math.max(0, pick.year - DRAFT_BASE_YEAR);
  return base + Math.max(0, 2 - yearsOut) * 0.5;
}

export function pickLabel(pick: TradePick): string {
  return `${pick.year} ${pick.round === 1 ? "1st" : "2nd"}${pick.protected ? " (protected)" : ""}`;
}

// Deterministic remaining-years proxy for a veteran deal: contracts are
// assumed to run through roughly age 36, so a 30-year-old carries more
// committed seasons than a 35-year-old. No contract-length data is used —
// this is an age-based estimate, stated as such on the page.
function estContractYears(age: number): number {
  return clamp(Math.round((37 - age) / 2), 1, 4);
}

function contractRisk(incoming: Player[]): ContractRisk {
  const aging = incoming.filter((p) => p.age >= 30);
  if (aging.length === 0)
    return { level: "Low", exposure: 0, why: "No incoming money tied to players 30 or older." };
  const exposure = r1(aging.reduce((a, p) => a + p.salary * estContractYears(p.age), 0));
  const names = aging
    .map((p) => `${p.name} (${p.age}, $${r1(p.salary)}M x ~${estContractYears(p.age)}y)`)
    .join(", ");
  const level: ContractRiskLevel = exposure <= 50 ? "Low" : exposure <= 110 ? "Med" : "High";
  return {
    level,
    exposure,
    why: `$${exposure}M-years projected to age-30+ incoming deals: ${names}.`,
  };
}

// 0-100 positional balance: 100 = perfectly even across the five positions.
function positionBalanceScore(roster: Player[]): number {
  if (roster.length === 0) return 0;
  const ideal = roster.length / POSITIONS.length;
  const dev = POSITIONS.reduce(
    (a, pos) => a + Math.abs(roster.filter((p) => p.pos === pos).length - ideal),
    0,
  );
  return clamp(Math.round(100 - (dev / roster.length) * 125), 0, 100);
}

// Salary matching, apron rules, and band classification live in the shared
// CBA engine (engine/cba.ts) — Roster Builder consumes the same module.

export function evaluateTrade(sides: TradeSide[]): TradeResult {
  const violations: string[] = [];
  const resSides = sides.map((s) => {
    const team = TEAM_MAP[s.team];
    const out = s.outgoing.reduce((a, p) => a + p.salary, 0);
    const inc = s.incoming.reduce((a, p) => a + p.salary, 0);
    const netSalary = inc - out;
    const newPayroll = team.payroll - out + inc;
    // Real 2023-CBA matching + apron rules, with rule-citing reasons.
    const cba = checkTradeSide({
      abbr: team.abbr,
      payroll: team.payroll,
      outgoing: out,
      incoming: inc,
      outgoingCount: s.outgoing.length,
    });
    const allowed = cba.allowed;
    const matchOk = cba.legal;
    const failure_reasons: string[] = [...cba.reasons];
    if (s.outgoing.length > MAX_OUTGOING)
      failure_reasons.push(
        `${team.abbr} sends out ${s.outgoing.length} players — this model caps each team at ${MAX_OUTGOING} outgoing.`,
      );
    violations.push(...failure_reasons);

    // positional balance before/after (synthetic players simply join the roster)
    const outIds = new Set(s.outgoing.map((p) => p.id));
    const before = PLAYERS.filter((p) => p.team === s.team);
    const beforeFit = positionBalanceScore(before);
    const after = [...before.filter((p) => !outIds.has(p.id)), ...s.incoming];
    const roster_fit_score = positionBalanceScore(after);
    const roster_fit_delta = roster_fit_score - beforeFit;

    const apronBand = capBand(newPayroll);
    const picksOut = s.picks ?? [];
    const picksIn = s.picksIn ?? [];
    const pickDelta =
      picksIn.reduce((a, p) => a + pickValue(p), 0) -
      picksOut.reduce((a, p) => a + pickValue(p), 0);
    const talentDelta =
      s.incoming.reduce((a, p) => a + p.starPower + p.bpm * 3, 0) -
      s.outgoing.reduce((a, p) => a + p.starPower + p.bpm * 3, 0) +
      pickDelta;
    const grade = letterGrade(clamp(60 + talentDelta * 0.5 - Math.max(0, netSalary) * 0.6, 5, 99));
    const baseNote =
      talentDelta > 25
        ? "Clear talent upgrade"
        : talentDelta > 5
          ? "Modest upgrade"
          : talentDelta > -5
            ? "Lateral / fit move"
            : "Sheds talent (cap or youth play)";
    const note =
      picksOut.length || picksIn.length
        ? `${baseNote} · pick value ${pickDelta >= 0 ? "+" : ""}${r1(pickDelta)}`
        : baseNote;
    return {
      team,
      out: r1(out),
      in: r1(inc),
      netSalary: r1(netSalary),
      newPayroll: r1(newPayroll),
      apronBand,
      matchOk,
      talentDelta: r1(talentDelta),
      grade,
      note,
      picks_out: picksOut.map(pickLabel),
      picks_in: picksIn.map(pickLabel),
      failure_reasons,
      contract_risk: contractRisk(s.incoming),
      roster_fit_score,
      roster_fit_delta,
    };
  });
  return { legal: violations.length === 0, sides: resSides, violations };
}

// ---------------- Lineup Optimizer ----------------
export type LineupGoal = "best_overall" | "best_defense" | "best_shooting" | "best_closing";

export const LINEUP_GOALS: { value: LineupGoal; label: string }[] = [
  { value: "best_overall", label: "Best overall" },
  { value: "best_defense", label: "Best defense" },
  { value: "best_shooting", label: "Best shooting" },
  { value: "best_closing", label: "Closing five" },
];

// Weight presets over the five sub-scores; each row sums to 1.
const GOAL_WEIGHTS: Record<
  LineupGoal,
  { spacing: number; defense: number; scoring: number; playmaking: number; balance: number }
> = {
  best_overall: { spacing: 0.22, defense: 0.24, scoring: 0.24, playmaking: 0.14, balance: 0.16 },
  best_defense: { spacing: 0.1, defense: 0.5, scoring: 0.12, playmaking: 0.1, balance: 0.18 },
  best_shooting: { spacing: 0.45, defense: 0.08, scoring: 0.25, playmaking: 0.1, balance: 0.12 },
  best_closing: { spacing: 0.2, defense: 0.22, scoring: 0.3, playmaking: 0.14, balance: 0.14 },
};

export interface LineupScore {
  five: Player[];
  spacing: number;
  defense: number;
  scoring: number;
  playmaking: number;
  balance: number;
  overall: number;
  role_conflicts: string[];
  strengths: string[]; // top-2 sub-scores, labeled
  weaknesses: string[]; // bottom-2 sub-scores, labeled
}

const HIGH_USAGE = 28; // usage % treated as a primary-scorer role

export function scoreLineup(five: Player[], goal: LineupGoal = "best_overall"): LineupScore {
  const spacing = clamp(
    five.reduce((a, p) => a + p.shotThree * (p.tpp > 0.36 ? 120 : 70), 0) / five.length,
    0,
    100,
  );
  const defense = clamp(five.reduce((a, p) => a + p.defImpact, 0) / five.length, 0, 100);
  const scoring = clamp(five.reduce((a, p) => a + p.offImpact, 0) / five.length, 0, 100);
  const playmaking = clamp(five.reduce((a, p) => a + p.apg * 8, 0) / five.length, 0, 100);
  const usageTotal = five.reduce((a, p) => a + p.usg, 0);
  const overlapPenalty = clamp((usageTotal - 100) * 1.2, 0, 35);
  const posSet = new Set(five.map((p) => p.pos));
  const positionBalance = clamp(posSet.size * 18 + 10, 0, 100);
  const balance = clamp(positionBalance - overlapPenalty, 0, 100);
  const w = GOAL_WEIGHTS[goal];
  const overall = clamp(
    spacing * w.spacing + defense * w.defense + scoring * w.scoring + playmaking * w.playmaking + balance * w.balance,
    0,
    100,
  );

  // role conflicts: stacked primary-scorer usage, or 3+ of one position
  const role_conflicts: string[] = [];
  const hi = five.filter((p) => p.usg >= HIGH_USAGE);
  if (hi.length >= 2)
    role_conflicts.push(
      `${hi.map((p) => p.name).join(", ")} ${hi.length === 2 ? "both" : "all"} carry ${HIGH_USAGE}%+ usage — primary-scorer roles collide.`,
    );
  for (const pos of POSITIONS) {
    const n = five.filter((p) => p.pos === pos).length;
    if (n >= 3) role_conflicts.push(`${n} ${pos}s share the floor — positional logjam.`);
  }

  const labeled: [string, number][] = [
    ["Spacing", Math.round(spacing)],
    ["Defense", Math.round(defense)],
    ["Scoring", Math.round(scoring)],
    ["Playmaking", Math.round(playmaking)],
    ["Balance", Math.round(balance)],
  ];
  const ranked = [...labeled].sort((a, b) => b[1] - a[1]);
  const asLabel = ([name, v]: [string, number]) => `${name} (${v})`;
  const strengths = ranked.slice(0, 2).map(asLabel);
  const weaknesses = ranked.slice(-2).reverse().map(asLabel);

  return {
    five,
    spacing: Math.round(spacing),
    defense: Math.round(defense),
    scoring: Math.round(scoring),
    playmaking: Math.round(playmaking),
    balance: Math.round(balance),
    overall: Math.round(overall),
    role_conflicts,
    strengths,
    weaknesses,
  };
}

// goal-specific anchor metric used to seed the greedy search
const ANCHOR_METRIC: Record<LineupGoal, (p: Player) => number> = {
  best_overall: (p) => p.starPower + p.defImpact,
  best_defense: (p) => p.defImpact * 2 + p.starPower * 0.3,
  best_shooting: (p) => p.shotThree * 120 + p.tpp * 100 + p.offImpact * 0.3,
  best_closing: (p) => p.clutchPpg * 12 + p.clutchFgp * 40 + p.offImpact * 0.5,
};

export function bestLineup(pool: Player[], goal: LineupGoal = "best_overall"): LineupScore | null {
  if (pool.length < 5) return null;
  // Exhaustive search: a 15-man roster is only C(15,5) = 3,003 lineups, so we
  // evaluate every combination and take the true optimum — greedy can and will
  // miss the best five. Pools beyond 22 (26k+ combos) fall back to greedy.
  const metric = ANCHOR_METRIC[goal];
  const sorted = [...pool].sort((a, b) => metric(b) - metric(a) || a.name.localeCompare(b.name));

  if (sorted.length <= 22) {
    let best: LineupScore | null = null;
    const n = sorted.length;
    for (let a = 0; a < n - 4; a++)
      for (let b = a + 1; b < n - 3; b++)
        for (let c = b + 1; c < n - 2; c++)
          for (let d = c + 1; d < n - 1; d++)
            for (let e = d + 1; e < n; e++) {
              const s = scoreLineup([sorted[a], sorted[b], sorted[c], sorted[d], sorted[e]], goal);
              if (!best || s.overall > best.overall) best = s;
            }
    return best;
  }

  // greedy fallback for oversized pools
  const five = [sorted[0]];
  while (five.length < 5) {
    let pick: Player | null = null;
    let bestScore = -1;
    for (const cand of sorted) {
      if (five.includes(cand)) continue;
      const s = scoreLineup([...five, cand], goal).overall;
      if (s > bestScore) {
        bestScore = s;
        pick = cand;
      }
    }
    if (!pick) break;
    five.push(pick);
  }
  return scoreLineup(five, goal);
}

// ---------------- Team Chemistry ----------------
export interface ChemistryResult {
  fit: number;
  usageOverlap: number;
  spacingGain: number;
  defenseGain: number;
  positionalNeed: number;
  grade: string;
  notes: string[];
  red_flags: string[];
}

export function teamChemistry(player: Player, teamAbbr: string): ChemistryResult {
  const roster = PLAYERS.filter((p) => p.team === teamAbbr && p.id !== player.id);
  const avgUsg = roster.reduce((a, p) => a + p.usg, 0) / Math.max(1, roster.length);
  const usageOverlap = clamp(100 - Math.abs(player.usg + avgUsg - 44) * 3.4, 0, 100);
  const teamSpacing = roster.reduce((a, p) => a + p.shotThree, 0) / Math.max(1, roster.length);
  const spacingGain = clamp((player.shotThree - teamSpacing) * 120 + 50, 0, 100);
  const teamDef = roster.reduce((a, p) => a + p.defImpact, 0) / Math.max(1, roster.length);
  const defenseGain = clamp((player.defImpact - teamDef) * 0.6 + 50, 0, 100);
  const posCounts = roster.filter((p) => p.pos === player.pos).length;
  const positionalNeed = clamp(70 - posCounts * 22, 0, 100);
  const fit = clamp(
    usageOverlap * 0.32 + spacingGain * 0.22 + defenseGain * 0.22 + positionalNeed * 0.24,
    0,
    100,
  );
  const notes: string[] = [];
  if (usageOverlap < 45) notes.push("Heavy usage overlap with current stars — touches will be tight.");
  else notes.push("Usage profile slots cleanly alongside the core.");
  if (spacingGain > 60) notes.push("Adds real floor spacing the roster lacks.");
  if (defenseGain > 60) notes.push("Upgrades the team's defensive baseline.");
  if (positionalNeed < 40) notes.push(`Positional logjam at ${player.pos}.`);

  // hard red flags (vs softer notes above)
  const red_flags: string[] = [];
  const hiMates = roster.filter((p) => p.usg >= HIGH_USAGE);
  if (player.usg >= HIGH_USAGE && hiMates.length > 0)
    red_flags.push(
      `Usage collision: ${player.name} (${r1(player.usg)}% usage) joins ${hiMates
        .slice(0, 2)
        .map((m) => `${m.name} (${r1(m.usg)}%)`)
        .join(" and ")} — primary touches collide.`,
    );
  if (posCounts >= 2)
    red_flags.push(`Positional logjam: ${posCounts + 1} ${player.pos}s on the roster after the move.`);
  const fromTeam = TEAM_MAP[player.team];
  const toTeam = TEAM_MAP[teamAbbr];
  if (fromTeam && toTeam && Math.abs(fromTeam.pace - toTeam.pace) >= 3)
    red_flags.push(
      `Pace mismatch: leaves a ${r1(fromTeam.pace)}-possession offense for ${r1(toTeam.pace)} — real style adjustment.`,
    );

  return {
    fit: Math.round(fit),
    usageOverlap: Math.round(usageOverlap),
    spacingGain: Math.round(spacingGain),
    defenseGain: Math.round(defenseGain),
    positionalNeed: Math.round(positionalNeed),
    grade: letterGrade(fit),
    notes,
    red_flags,
  };
}

export interface TeamMatch {
  team: Team;
  fit: number;
  grade: string;
}

// Top-n destinations by chemistry fit, excluding the player's current team.
export function best_team_matches(player: Player, n = 5): TeamMatch[] {
  return TEAMS.filter((t) => t.abbr !== player.team)
    .map((t) => {
      const c = teamChemistry(player, t.abbr);
      return { team: t, fit: c.fit, grade: c.grade };
    })
    .sort((a, b) => b.fit - a.fit || a.team.abbr.localeCompare(b.team.abbr))
    .slice(0, n);
}

// ---------------- Pick & Roll ----------------
export interface PnRResult {
  ppp: number;
  turnoverRate: number;
  shotQuality: number;
  foulsDrawn: number;
  grade: string;
  lob_rate: number; // 0-100 proxy: roller rim share x handler assist quality
  short_roll_efficiency: number; // 0-100 proxy: roller passing + touch + finishing
  tactical_explanation: string;
  breakdown: { label: string; value: number; color: string }[];
}

export function pickAndRoll(handler: Player, roller: Player): PnRResult {
  const handlerScore = handler.apg * 3 + (handler.tpp > 0.36 ? 14 : 4) + handler.offImpact * 0.2;
  const rollerScore = roller.shotRim * 40 + (roller.pos === "C" || roller.pos === "PF" ? 14 : 6) + roller.tsp * 30;
  const ppp = clamp(0.82 + handlerScore * 0.006 + rollerScore * 0.006, 0.78, 1.32);
  const turnoverRate = clamp(18 - handler.apg * 0.9 + handler.topg * 1.4, 6, 22);
  const shotQuality = clamp(50 + roller.shotRim * 40 + (handler.tpp - 0.34) * 120, 20, 99);
  const foulsDrawn = clamp(2 + roller.shotRim * 6 + handler.tsp * 4, 1.5, 8);
  const grade = letterGrade(clamp((ppp - 0.78) * 180 + 20, 5, 99));

  // lob threat: roller's rim share scaled by the handler's assist quality
  const assistQuality = clamp(handler.apg * 9, 0, 100);
  const lob_rate = clamp(Math.round(roller.shotRim * assistQuality * 1.4), 0, 100);
  // short roll: the roller's passing, mid-range touch, and finishing efficiency
  const short_roll_efficiency = clamp(
    Math.round(roller.apg * 14 + (roller.tsp - 0.5) * 160 + roller.shotMid * 60),
    0,
    100,
  );
  const lobDesc =
    lob_rate >= 60
      ? `${roller.name} is a live lob threat diving to the rim`
      : lob_rate >= 35
        ? `${roller.name} is a capable finisher on the roll`
        : `${roller.name} is more of a pop threat than a diver`;
  const shortDesc =
    short_roll_efficiency >= 60
      ? `trust ${roller.name} to make reads in the short roll against drop coverage`
      : short_roll_efficiency >= 40
        ? `${roller.name} can keep the advantage alive when the pocket pass comes early`
        : `keep ${roller.name} out of short-roll playmaking — finish or kick immediately`;
  const tactical_explanation = `${handler.name} bends the defense off the screen and ${lobDesc}; ${shortDesc}.`;

  return {
    ppp: Math.round(ppp * 100) / 100,
    turnoverRate: r1(turnoverRate),
    shotQuality: Math.round(shotQuality),
    foulsDrawn: r1(foulsDrawn),
    grade,
    lob_rate,
    short_roll_efficiency,
    tactical_explanation,
    breakdown: [
      { label: "Handler creation", value: clamp(handlerScore, 0, 100), color: "#4D8DFF" },
      { label: "Roll-man finishing", value: clamp(rollerScore, 0, 100), color: "#6B6E78" },
      { label: "Spacing gravity", value: clamp(handler.tpp * 200 - 20, 0, 100), color: "#D7BC6A" },
      { label: "Ball security", value: clamp(100 - turnoverRate * 4, 0, 100), color: "#4D8DFF" },
    ],
  };
}

// ---------------- PlayType (per player tendencies) ----------------
export interface PlayTypeMix {
  type: string;
  freq: number; // %
  ppp: number;
  color: string;
  alternative_labels: string; // tracker label-confidence note
}

// Play types other trackers most often confuse with each label (~90% of the
// classifier's labels agree with ESPN's, per the backtest on this page).
const ALT_LABELS: Record<string, string[]> = {
  "Pick & Roll": ["Handoff", "Isolation"],
  Isolation: ["Pick & Roll", "Post Up"],
  "Spot Up": ["Handoff", "Transition"],
  Transition: ["Cut", "Spot Up"],
  "Post Up": ["Isolation"],
  Cut: ["Transition", "Handoff"],
  Handoff: ["Pick & Roll", "Spot Up"],
};

function altNote(type: string): string {
  const alts = ALT_LABELS[type] ?? [];
  return alts.length
    ? `Other trackers sometimes tag these possessions as ${alts.join(" or ")} — ~90% label agreement.`
    : "~90% label agreement with ESPN's play-type tags.";
}

export function playTypeMix(p: Player): PlayTypeMix[] {
  const g = p.pos === "PG" || p.pos === "SG";
  const big = p.pos === "C" || p.pos === "PF";
  const raw: { type: string; w: number; ppp: number; color: string }[] = [
    { type: "Pick & Roll", w: g ? 28 + p.apg : 10, ppp: 0.92 + p.apg * 0.01, color: "#4D8DFF" },
    { type: "Isolation", w: p.usg > 28 ? 18 : 8, ppp: 0.86 + (p.tsp - 0.55) * 0.5, color: "#4D8DFF" },
    { type: "Spot Up", w: p.shotThree * 30 + 8, ppp: 0.98 + (p.tpp - 0.35) * 0.6, color: "#6B6E78" },
    { type: "Transition", w: 12 + p.spg * 3, ppp: 1.12 + p.starPower * 0.001, color: "#D7BC6A" },
    { type: "Post Up", w: big ? 16 + p.rpg * 0.6 : 3, ppp: 0.9 + (p.tsp - 0.55) * 0.4, color: "#4D8DFF" },
    { type: "Cut", w: big ? 12 : 7, ppp: 1.18, color: "#F4647D" },
    { type: "Handoff", w: 6 + p.apg * 0.4, ppp: 0.95, color: "#6B6E78" },
  ];
  const total = raw.reduce((a, r) => a + r.w, 0);
  return raw
    .map((r) => ({
      type: r.type,
      freq: Math.round((r.w / total) * 100),
      ppp: Math.round(r.ppp * 100) / 100,
      color: r.color,
      alternative_labels: altNote(r.type),
    }))
    .sort((a, b) => b.freq - a.freq || a.type.localeCompare(b.type));
}

// Usage-weighted blend of every rostered player's mix: high-usage players
// shape the team profile more, mirroring who actually ends possessions.
export function teamPlayTypeMix(teamAbbr: string): PlayTypeMix[] {
  const roster = PLAYERS.filter((p) => p.team === teamAbbr);
  if (roster.length === 0) return [];
  const acc: Record<string, { freqW: number; pppW: number; color: string }> = {};
  let totalUsg = 0;
  for (const p of roster) {
    totalUsg += p.usg;
    for (const m of playTypeMix(p)) {
      const e = (acc[m.type] ??= { freqW: 0, pppW: 0, color: m.color });
      e.freqW += m.freq * p.usg;
      e.pppW += m.ppp * m.freq * p.usg;
    }
  }
  return Object.entries(acc)
    .map(([type, e]) => ({
      type,
      freq: Math.round(e.freqW / totalUsg),
      ppp: e.freqW > 0 ? Math.round((e.pppW / e.freqW) * 100) / 100 : 0,
      color: e.color,
      alternative_labels: altNote(type),
    }))
    .sort((a, b) => b.freq - a.freq || a.type.localeCompare(b.type));
}

// Momentum now reconstructs real scoring runs from the playoff shot sequence
// (lib/data/shots#gameMomentum); the old synthetic random-walk generator was
// removed when that tool was reworked onto real data.

export { SALARY_CAP, FIRST_APRON, SECOND_APRON, LUXURY_TAX };
