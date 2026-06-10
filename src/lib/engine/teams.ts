import type { Player, Team } from "@/lib/types";
import { PLAYERS, TEAM_MAP, SALARY_CAP, FIRST_APRON, SECOND_APRON, LUXURY_TAX } from "@/lib/data";
import { letterGrade } from "@/lib/cn";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------------- Trade Machine ----------------
export interface TradeSide {
  team: string;
  outgoing: Player[];
  incoming: Player[];
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
  }[];
  violations: string[];
}

function matchAllowance(out: number, payroll: number): number {
  // simplified 2024 CBA matching: 100%+250k under tax; tighter over apron
  if (payroll > FIRST_APRON) return out + 0.25; // 100% over first apron
  if (out <= 7.5) return out * 2 + 0.25;
  if (out <= 29) return out + 7.5;
  return out * 1.25 + 0.25;
}

export function evaluateTrade(sides: TradeSide[]): TradeResult {
  const violations: string[] = [];
  const resSides = sides.map((s) => {
    const team = TEAM_MAP[s.team];
    const out = s.outgoing.reduce((a, p) => a + p.salary, 0);
    const inc = s.incoming.reduce((a, p) => a + p.salary, 0);
    const netSalary = inc - out;
    const newPayroll = team.payroll - out + inc;
    const allowed = matchAllowance(out, team.payroll);
    const matchOk = inc <= allowed || team.payroll - out + inc <= SALARY_CAP;
    if (!matchOk)
      violations.push(
        `${team.abbr} takes in $${r1(inc)}M but can only absorb $${r1(allowed)}M for $${r1(out)}M out.`,
      );
    if (newPayroll > SECOND_APRON && netSalary > 0)
      violations.push(`${team.abbr} is hard-capped at the 2nd apron and cannot add salary.`);
    const apronBand =
      newPayroll > SECOND_APRON
        ? "2nd Apron"
        : newPayroll > FIRST_APRON
          ? "1st Apron"
          : newPayroll > LUXURY_TAX
            ? "Luxury Tax"
            : newPayroll > SALARY_CAP
              ? "Over Cap"
              : "Under Cap";
    const talentDelta =
      s.incoming.reduce((a, p) => a + p.starPower + p.bpm * 3, 0) -
      s.outgoing.reduce((a, p) => a + p.starPower + p.bpm * 3, 0);
    const grade = letterGrade(clamp(60 + talentDelta * 0.5 - Math.max(0, netSalary) * 0.6, 5, 99));
    const note =
      talentDelta > 25
        ? "Clear talent upgrade"
        : talentDelta > 5
          ? "Modest upgrade"
          : talentDelta > -5
            ? "Lateral / fit move"
            : "Sheds talent (cap or youth play)";
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
    };
  });
  return { legal: violations.length === 0, sides: resSides, violations };
}

// ---------------- Lineup Optimizer ----------------
export interface LineupScore {
  five: Player[];
  spacing: number;
  defense: number;
  scoring: number;
  playmaking: number;
  balance: number;
  overall: number;
}

export function scoreLineup(five: Player[]): LineupScore {
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
  const overall = clamp(
    spacing * 0.22 + defense * 0.24 + scoring * 0.24 + playmaking * 0.14 + balance * 0.16,
    0,
    100,
  );
  return {
    five,
    spacing: Math.round(spacing),
    defense: Math.round(defense),
    scoring: Math.round(scoring),
    playmaking: Math.round(playmaking),
    balance: Math.round(balance),
    overall: Math.round(overall),
  };
}

export function bestLineup(pool: Player[]): LineupScore | null {
  if (pool.length < 5) return null;
  // greedy: anchor with highest overall composite, then add complements maximizing marginal score
  const sorted = [...pool].sort((a, b) => b.starPower + b.defImpact - (a.starPower + a.defImpact));
  let five = [sorted[0]];
  while (five.length < 5) {
    let best: Player | null = null;
    let bestScore = -1;
    for (const cand of sorted) {
      if (five.includes(cand)) continue;
      const s = scoreLineup([...five, cand]).overall;
      if (s > bestScore) {
        bestScore = s;
        best = cand;
      }
    }
    if (!best) break;
    five.push(best);
  }
  return scoreLineup(five);
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
  return {
    fit: Math.round(fit),
    usageOverlap: Math.round(usageOverlap),
    spacingGain: Math.round(spacingGain),
    defenseGain: Math.round(defenseGain),
    positionalNeed: Math.round(positionalNeed),
    grade: letterGrade(fit),
    notes,
  };
}

// ---------------- Pick & Roll ----------------
export interface PnRResult {
  ppp: number;
  turnoverRate: number;
  shotQuality: number;
  foulsDrawn: number;
  grade: string;
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
  return {
    ppp: Math.round(ppp * 100) / 100,
    turnoverRate: r1(turnoverRate),
    shotQuality: Math.round(shotQuality),
    foulsDrawn: r1(foulsDrawn),
    grade,
    breakdown: [
      { label: "Handler creation", value: clamp(handlerScore, 0, 100), color: "#E0561F" },
      { label: "Roll-man finishing", value: clamp(rollerScore, 0, 100), color: "#7E8CA0" },
      { label: "Spacing gravity", value: clamp(handler.tpp * 200 - 20, 0, 100), color: "#C9A14A" },
      { label: "Ball security", value: clamp(100 - turnoverRate * 4, 0, 100), color: "#5FA97E" },
    ],
  };
}

// ---------------- PlayType (per player tendencies) ----------------
export interface PlayTypeMix {
  type: string;
  freq: number; // %
  ppp: number;
  color: string;
}

export function playTypeMix(p: Player): PlayTypeMix[] {
  const g = p.pos === "PG" || p.pos === "SG";
  const big = p.pos === "C" || p.pos === "PF";
  const raw: { type: string; w: number; ppp: number; color: string }[] = [
    { type: "Pick & Roll", w: g ? 28 + p.apg : 10, ppp: 0.92 + p.apg * 0.01, color: "#E0561F" },
    { type: "Isolation", w: p.usg > 28 ? 18 : 8, ppp: 0.86 + (p.tsp - 0.55) * 0.5, color: "#E0561F" },
    { type: "Spot Up", w: p.shotThree * 30 + 8, ppp: 0.98 + (p.tpp - 0.35) * 0.6, color: "#7E8CA0" },
    { type: "Transition", w: 12 + p.spg * 3, ppp: 1.12 + p.starPower * 0.001, color: "#C9A14A" },
    { type: "Post Up", w: big ? 16 + p.rpg * 0.6 : 3, ppp: 0.9 + (p.tsp - 0.55) * 0.4, color: "#5FA97E" },
    { type: "Cut", w: big ? 12 : 7, ppp: 1.18, color: "#BF5B4E" },
    { type: "Handoff", w: 6 + p.apg * 0.4, ppp: 0.95, color: "#7E8CA0" },
  ];
  const total = raw.reduce((a, r) => a + r.w, 0);
  return raw
    .map((r) => ({
      type: r.type,
      freq: Math.round((r.w / total) * 100),
      ppp: Math.round(r.ppp * 100) / 100,
      color: r.color,
    }))
    .sort((a, b) => b.freq - a.freq);
}

// Momentum now reconstructs real scoring runs from the playoff shot sequence
// (lib/data/shots#gameMomentum); the old synthetic random-walk generator was
// removed when that tool was reworked onto real data.

export { SALARY_CAP, FIRST_APRON, SECOND_APRON, LUXURY_TAX };
