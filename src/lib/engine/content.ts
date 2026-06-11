import type { Player } from "@/lib/types";
import { PLAYERS, getPlayer } from "@/lib/data";
import { letterGrade } from "@/lib/cn";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------------- Fantasy Draft Assistant ----------------
export type PuntCategory = "none" | "ft" | "fg" | "ast" | "to" | "3pt";
export interface FantasyRow {
  player: Player;
  zScore: number;
  rank: number;
  scarcity: number;
  cats: { pts: number; reb: number; ast: number; stl: number; blk: number; threes: number };
}

// 12 teams × 13 roster slots — the pool that actually gets drafted. Z-scores
// against all 536 players inflate everyone (replacement-level scrubs drag the
// mean down); the relevant distribution is the draftable pool, so we
// standardize twice: a first pass over everyone to find the ~156 draftables,
// then a second pass standardized within that pool (post-punt).
export const DRAFTABLE_POOL = 156;

export function fantasyBoard(punt: PuntCategory = "none"): FantasyRow[] {
  const CATS: { key: string; f: (p: Player) => number }[] = [
    { key: "pts", f: (p) => p.ppg },
    { key: "reb", f: (p) => p.rpg },
    { key: "ast", f: (p) => p.apg },
    { key: "stl", f: (p) => p.spg },
    { key: "blk", f: (p) => p.bpg },
    { key: "threes", f: (p) => p.tpa * p.tpp },
    { key: "fg", f: (p) => p.fgp },
    { key: "ft", f: (p) => p.ftp },
    { key: "to", f: (p) => -p.topg },
  ];
  const zFns = (pool: Player[]) =>
    CATS.map(({ key, f }) => {
      const m = pool.reduce((a, p) => a + f(p), 0) / pool.length;
      const sd = Math.sqrt(pool.reduce((a, p) => a + (f(p) - m) ** 2, 0) / pool.length) || 1;
      return { key, z: (p: Player) => (f(p) - m) / sd };
    });
  const total = (p: Player, fns: ReturnType<typeof zFns>) =>
    fns.reduce((a, { key, z }) => a + (punt !== "none" && key === punt ? 0 : z(p)), 0);

  // pass 1: rank everyone against the full league to find the draftable pool
  const all = zFns(PLAYERS);
  const draftable = [...PLAYERS]
    .sort((a, b) => total(b, all) - total(a, all))
    .slice(0, DRAFTABLE_POOL);

  // pass 2: standardize within the draftable pool (punted category excluded
  // from the sum, so the remaining categories re-rank the board)
  const fns = zFns(draftable);
  const rows = draftable
    .map((p) => {
      const parts: Record<string, number> = {};
      for (const { key, z } of fns) parts[key] = punt !== "none" && key === punt ? 0 : z(p);
      const zScore = Object.values(parts).reduce((a, v) => a + v, 0);
      return {
        player: p,
        zScore: Math.round(zScore * 100) / 100,
        rank: 0,
        scarcity: 0,
        cats: {
          pts: Math.round(parts.pts * 100) / 100,
          reb: Math.round(parts.reb * 100) / 100,
          ast: Math.round(parts.ast * 100) / 100,
          stl: Math.round(parts.stl * 100) / 100,
          blk: Math.round(parts.blk * 100) / 100,
          threes: Math.round(parts.threes * 100) / 100,
        },
      };
    })
    .sort((a, b) => b.zScore - a.zScore);
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.scarcity = Math.round(clamp((r.player.pos === "C" ? 70 : r.player.pos === "PG" ? 55 : 45) + r.player.bpg * 6, 0, 100));
  });
  return rows;
}

// ---------------- Draft-session assistant ----------------
export type FantasyCat = "pts" | "reb" | "ast" | "stl" | "blk" | "threes";
const FANTASY_CATS: FantasyCat[] = ["pts", "reb", "ast", "stl", "blk", "threes"];
const CAT_LABEL: Record<FantasyCat, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  threes: "3PM",
};
// Punted categories that map onto the six counting cats tracked per row.
const PUNT_TO_CAT: Partial<Record<PuntCategory, FantasyCat>> = { ast: "ast", "3pt": "threes" };

export interface DraftRecommendation {
  player: Player;
  fit_score: number; // 0-100 — how directly the player fills this roster's weakest categories
  scarcity_score: number; // 0-100 — how thin the player's position is among undrafted players
  risk_score: number; // 0-100 — availability proxy from games missed and age
  score: number; // composite used for the recommendation ranking
  reasoning: string;
}

function categoryTotals(
  myRoster: Player[],
  rowById: Map<string, FantasyRow>,
): Record<FantasyCat, number> {
  const totals = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, threes: 0 };
  for (const p of myRoster) {
    const row = rowById.get(p.id);
    if (!row) continue;
    for (const c of FANTASY_CATS) totals[c] += row.cats[c];
  }
  return totals;
}

/** Roster category strength (summed z), weakest first — drives the fit weights. */
export function rosterNeeds(
  myRoster: Player[],
  punt: PuntCategory = "none",
): { cat: FantasyCat; label: string; total: number }[] {
  const board = fantasyBoard(punt);
  const rowById = new Map(board.map((r) => [r.player.id, r]));
  const totals = categoryTotals(myRoster, rowById);
  return FANTASY_CATS.filter((c) => PUNT_TO_CAT[punt] !== c)
    .map((c) => ({ cat: c, label: CAT_LABEL[c], total: Math.round(totals[c] * 100) / 100 }))
    .sort((a, b) => a.total - b.total);
}

export function draftRecommend(
  myRoster: Player[],
  drafted: Set<string>,
  punt: PuntCategory = "none",
): DraftRecommendation[] {
  const board = fantasyBoard(punt);
  const rowById = new Map(board.map((r) => [r.player.id, r]));
  const taken = new Set(drafted);
  for (const p of myRoster) taken.add(p.id);

  const active = FANTASY_CATS.filter((c) => PUNT_TO_CAT[punt] !== c);
  const totals = categoryTotals(myRoster, rowById);

  // Need weights: the weaker my roster is in a category, the more a fill is worth.
  // Squaring the gap concentrates weight on the truly weak categories.
  // An empty (or perfectly balanced) roster weighs every category equally.
  const maxTotal = Math.max(...active.map((c) => totals[c]));
  const rawNeed = active.map((c) => (maxTotal - totals[c]) ** 2);
  const needSum = rawNeed.reduce((a, v) => a + v, 0);
  const weights = new Map<FantasyCat, number>();
  active.forEach((c, i) =>
    weights.set(c, needSum > 0 ? rawNeed[i] / needSum : 1 / active.length),
  );
  const weakest = [...active].sort((x, y) => totals[x] - totals[y]).slice(0, 2);

  const available = board.filter((r) => !taken.has(r.player.id));

  // Position scarcity: how many above-replacement players (z >= 2) remain per position.
  const qualityLeft: Record<string, number> = {};
  for (const r of available) {
    if (r.zScore >= 2) qualityLeft[r.player.pos] = (qualityLeft[r.player.pos] ?? 0) + 1;
  }

  return available
    .map((r) => {
      const p = r.player;
      // Fit measures FILLING the roster's weak categories — a specialist's
      // spike in a needed cat counts in full, and his weak unrelated cats
      // don't subtract (overall value is the composite's zScore term, not
      // fit's job). Hence the max(0, ·).
      const fitRaw = active.reduce((a, c) => a + (weights.get(c) ?? 0) * Math.max(0, r.cats[c]), 0);
      const fit_score = Math.round(clamp(50 + fitRaw * 22, 0, 100) * 10) / 10;
      const left = qualityLeft[p.pos] ?? 0;
      const scarcity_score = Math.round(clamp(96 - left * 14, 4, 96));
      const missed = Math.max(0, 78 - p.gp);
      const risk_score = Math.round(clamp(missed * 2 + Math.max(0, p.age - 29) * 5 + 4, 2, 98));
      const score =
        Math.round(
          (r.zScore * 6 + fit_score * 0.5 + scarcity_score * 0.18 - risk_score * 0.15) * 10,
        ) / 10;
      const bestCat = active.reduce((best, c) => (r.cats[c] > r.cats[best] ? c : best), active[0]);
      const needHit = weakest.filter((c) => r.cats[c] > 0.25).map((c) => CAT_LABEL[c]);
      const reasoning =
        (needHit.length > 0
          ? `Fills your thinnest categor${needHit.length > 1 ? "ies" : "y"} (${needHit.join(", ")})`
          : `Best remaining ${CAT_LABEL[bestCat]} value`) +
        ` at ${r.zScore >= 0 ? "+" : ""}${r.zScore} z overall; ${left} above-replacement ${p.pos}${left === 1 ? "" : "s"} left; ` +
        `${p.gp} GP at age ${p.age} ${
          risk_score >= 60
            ? "is a real availability risk"
            : risk_score >= 35
              ? "carries some availability risk"
              : "is a durable profile"
        }.`;
      return { player: p, fit_score, scarcity_score, risk_score, score, reasoning };
    })
    .sort((x, y) => y.score - x.score || x.player.name.localeCompare(y.player.name));
}

// ---------------- March Madness ----------------
export interface NcaaTeam {
  name: string;
  seed: number;
  eff: number; // net efficiency
  sos: number;
  form: number; // recent
  color: string;
}
export const NCAA_FIELD: NcaaTeam[] = [
  { name: "UConn", seed: 1, eff: 28.5, sos: 8.2, form: 0.9, color: "#0C2340" },
  { name: "Houston", seed: 1, eff: 27.1, sos: 7.8, form: 0.85, color: "#CE1141" },
  { name: "Purdue", seed: 1, eff: 26.4, sos: 6.5, form: 0.8, color: "#CFB991" },
  { name: "Arizona", seed: 2, eff: 24.0, sos: 7.0, form: 0.75, color: "#003366" },
  { name: "Tennessee", seed: 2, eff: 23.2, sos: 8.0, form: 0.7, color: "#FF8200" },
  { name: "Iowa State", seed: 2, eff: 22.8, sos: 6.8, form: 0.78, color: "#C8102E" },
  { name: "Duke", seed: 3, eff: 21.5, sos: 7.2, form: 0.72, color: "#003087" },
  { name: "Kentucky", seed: 3, eff: 20.9, sos: 7.5, form: 0.68, color: "#0033A0" },
  { name: "Marquette", seed: 4, eff: 19.8, sos: 6.0, form: 0.74, color: "#003366" },
  { name: "Alabama", seed: 4, eff: 19.2, sos: 7.1, form: 0.66, color: "#9E1B32" },
  { name: "Creighton", seed: 5, eff: 18.4, sos: 5.5, form: 0.7, color: "#005CA9" },
  { name: "Gonzaga", seed: 5, eff: 18.0, sos: 5.0, form: 0.76, color: "#002967" },
  { name: "BYU", seed: 6, eff: 16.5, sos: 5.8, form: 0.64, color: "#002E5D" },
  { name: "Texas", seed: 6, eff: 16.0, sos: 6.4, form: 0.6, color: "#BF5700" },
  { name: "Florida", seed: 7, eff: 15.2, sos: 5.2, form: 0.62, color: "#0021A5" },
  { name: "Saint Mary's", seed: 7, eff: 14.8, sos: 4.6, form: 0.66, color: "#06315B" },
];

export type BracketEmphasis = "balanced" | "efficiency" | "form";

interface EdgeBreakdown {
  eff: number;
  sos: number;
  form: number;
  seed: number;
  total: number;
}

function edgeBreakdown(a: NcaaTeam, b: NcaaTeam, emphasis: BracketEmphasis = "balanced"): EdgeBreakdown {
  const w =
    emphasis === "efficiency"
      ? { eff: 1.35, sos: 0.5, form: 4, seed: 0.7 }
      : emphasis === "form"
        ? { eff: 0.7, sos: 0.3, form: 16, seed: 0.45 }
        : { eff: 1, sos: 0.4, form: 8, seed: 0.6 };
  const eff = (a.eff - b.eff) * w.eff;
  const sos = (a.sos - b.sos) * w.sos;
  const form = (a.form - b.form) * w.form;
  const seed = (b.seed - a.seed) * w.seed;
  return { eff, sos, form, seed, total: eff + sos + form + seed };
}

function winProb(a: NcaaTeam, b: NcaaTeam, emphasis: BracketEmphasis = "balanced"): number {
  return clamp(1 / (1 + Math.exp(-edgeBreakdown(a, b, emphasis).total / 7)), 0.05, 0.95);
}

export interface MatchupFactor {
  label: string;
  edge: number; // signed contribution to the weighted edge (positive favors team a)
  favors: string; // team name the factor leans toward
}

export interface MatchupResult {
  a: NcaaTeam;
  b: NcaaTeam;
  win_probability: number; // % chance team a wins (5-95)
  projected_score: { a: number; b: number };
  key_factors: MatchupFactor[]; // top-2 edge components by absolute contribution
  upset_risk: number; // 0-100 — the worse seed's chance of winning
}

export function simulateMatchup(
  a: NcaaTeam,
  b: NcaaTeam,
  emphasis: BracketEmphasis = "balanced",
): MatchupResult {
  const parts = edgeBreakdown(a, b, emphasis);
  const p = clamp(1 / (1 + Math.exp(-parts.total / 7)), 0.05, 0.95);

  // Net efficiency is a per-100-possession margin. A tournament game runs about
  // 70 possessions, so the efficiency gap scales by 0.7, and both teams' quality
  // lifts the scoring baseline above 1.0 points per possession.
  const base = 70 + ((a.eff + b.eff) / 2) * 0.2;
  const margin = (a.eff - b.eff) * 0.7;
  const projected_score = {
    a: Math.round(base + margin / 2),
    b: Math.round(base - margin / 2),
  };

  const key_factors: MatchupFactor[] = [
    { label: "Net efficiency", edge: parts.eff },
    { label: "Schedule strength", edge: parts.sos },
    { label: "Recent form", edge: parts.form },
    { label: "Seeding", edge: parts.seed },
  ]
    .sort((x, y) => Math.abs(y.edge) - Math.abs(x.edge))
    .slice(0, 2)
    .map((f) => ({
      label: f.label,
      edge: Math.round(f.edge * 10) / 10,
      favors: f.edge >= 0 ? a.name : b.name,
    }));

  // Upset risk = the worse-seeded team's win chance; even seeds use the coin-flip margin.
  const dogProb = a.seed === b.seed ? Math.min(p, 1 - p) : a.seed > b.seed ? p : 1 - p;

  return {
    a,
    b,
    win_probability: Math.round(p * 1000) / 10,
    projected_score,
    key_factors,
    upset_risk: Math.round(dogProb * 100),
  };
}

export interface BracketGame {
  round: number;
  a: NcaaTeam;
  b: NcaaTeam;
  aProb: number;
  winner: NcaaTeam;
  upset: boolean;
}
// Exact tournament probabilities — no simulation needed. For a fixed
// single-elimination bracket, each team's chance of reaching every round is
// computable in closed form: P(win round r) = P(reached r) × Σ over possible
// opponents P(opponent reached r) × P(beat that opponent). Deterministic and
// exact where a Monte Carlo would be noisy.
export interface TitleOdds {
  team: NcaaTeam;
  semis: number; // P(reach final four), 0-100
  final: number;
  title: number;
}

export function titleOdds(emphasis: BracketEmphasis = "balanced"): TitleOdds[] {
  const n = NCAA_FIELD.length; // 16, bracket order = pairing order
  const rounds = Math.log2(n);
  // reach[t] = P(team t alive entering current round)
  let reach = NCAA_FIELD.map(() => 1);
  const perRound: number[][] = [];
  for (let r = 0; r < rounds; r++) {
    const size = n >> r; // teams notionally alive this round
    const next = NCAA_FIELD.map(() => 0);
    for (let t = 0; t < n; t++) {
      if (reach[t] === 0) continue;
      // block of potential opponents this round: the adjacent group of
      // 2^r teams on the other side of the pairing
      const block = 1 << r;
      const groupStart = Math.floor(t / (block * 2)) * (block * 2);
      const oppStart = t - groupStart < block ? groupStart + block : groupStart;
      let winP = 0;
      for (let o = oppStart; o < oppStart + block; o++) {
        if (o === t) continue;
        winP += reach[o] * winProb(NCAA_FIELD[t], NCAA_FIELD[o], emphasis);
      }
      next[t] = reach[t] * winP;
    }
    perRound.push(next);
    reach = next;
    if (size <= 2) break;
  }
  const semisIdx = rounds - 3; // survived to final four (16 → after round 2)
  const finalIdx = rounds - 2;
  const titleIdx = rounds - 1;
  return NCAA_FIELD.map((team, t) => ({
    team,
    semis: Math.round((perRound[semisIdx]?.[t] ?? 0) * 1000) / 10,
    final: Math.round((perRound[finalIdx]?.[t] ?? 0) * 1000) / 10,
    title: Math.round((perRound[titleIdx]?.[t] ?? 0) * 1000) / 10,
  })).sort((a, b) => b.title - a.title);
}

export function simulateBracket(
  emphasis: BracketEmphasis = "balanced",
): { rounds: BracketGame[][]; champion: NcaaTeam } {
  let alive = [...NCAA_FIELD];
  const rounds: BracketGame[][] = [];
  let roundNum = 1;
  while (alive.length > 1) {
    const games: BracketGame[] = [];
    const next: NcaaTeam[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i];
      const b = alive[i + 1];
      const ap = winProb(a, b, emphasis);
      const winner = ap >= 0.5 ? a : b;
      const upset = winner.seed > (ap >= 0.5 ? b.seed : a.seed);
      games.push({ round: roundNum, a, b, aProb: Math.round(ap * 100), winner, upset });
      next.push(winner);
    }
    rounds.push(games);
    alive = next;
    roundNum++;
  }
  return { rounds, champion: alive[0] };
}

// ---------------- Debate Evidence ----------------
export interface DebateCase {
  player: Player;
  points: string[];
}
export interface DebateResult {
  a: DebateCase;
  b: DebateCase;
  verdict: string;
  edge: number; // -100..100 toward a
  context_notes: string[]; // era/role caveats the raw edge can't see
  confidence_score: number; // 50-95, mapped from abs(edge)
}
export function debate(
  idA: string,
  idB: string,
  lens: "offense" | "defense" | "overall" = "overall",
): DebateResult | string {
  if (!idA?.trim() || !idB?.trim())
    return "Pick two players to start the debate — both sides need a name.";
  const a = getPlayer(idA.trim());
  const b = getPlayer(idB.trim());
  if (!a && !b)
    return `Neither "${idA}" nor "${idB}" matches a player in the dataset — search both pickers by name.`;
  if (!a) return `No player matches "${idA}" — pick side A from the player list.`;
  if (!b) return `No player matches "${idB}" — pick side B from the player list.`;
  if (a.id === b.id) return `${a.name} can't debate himself — pick two different players.`;
  const score = (p: Player) =>
    lens === "offense"
      ? p.offImpact + p.ppg + p.tsp * 40
      : lens === "defense"
        ? p.defImpact + p.bpg * 8 + p.spg * 6
        : p.starPower + p.per + p.bpm * 2;
  const makeCase = (p: Player, other: Player): string[] => {
    const pts: string[] = [];
    if (p.ppg > other.ppg) pts.push(`Outscores ${other.name} ${p.ppg} to ${other.ppg} per game.`);
    if (p.tsp > other.tsp) pts.push(`More efficient: ${(p.tsp * 100).toFixed(1)}% TS vs ${(other.tsp * 100).toFixed(1)}%.`);
    if (p.apg > other.apg) pts.push(`Better playmaker (${p.apg} vs ${other.apg} APG).`);
    if (p.defImpact > other.defImpact) pts.push(`Stronger defender (${p.defImpact} vs ${other.defImpact} impact).`);
    if (p.bpm > other.bpm) pts.push(`Higher box plus-minus (+${p.bpm} vs +${other.bpm}).`);
    if (p.rpg > other.rpg) pts.push(`Rebounds at a higher clip (${p.rpg} vs ${other.rpg}).`);
    if (pts.length < 2) pts.push(`Brings ${p.archetype.toLowerCase()} value the matchup needs.`);
    return pts.slice(0, 4);
  };
  const sa = score(a);
  const sb = score(b);
  const edge = Math.round(clamp(((sa - sb) / (sa + sb)) * 200, -100, 100));
  const verdict =
    Math.abs(edge) < 6
      ? `Statistically a coin-flip in the ${lens} lens — comes down to context and role.`
      : `${edge > 0 ? a.name : b.name} holds the edge in the ${lens} lens by the numbers.`;

  // Era/role caveats the box-score edge can't see.
  const context_notes: string[] = [];
  const ageGap = Math.abs(a.age - b.age);
  if (ageGap >= 4) {
    const older = a.age > b.age ? a : b;
    const younger = older.id === a.id ? b : a;
    context_notes.push(
      `${older.name} (${older.age}) and ${younger.name} (${younger.age}) are ${ageGap} years apart — this compares current seasons, not career peaks.`,
    );
  }
  const expGap = Math.abs(a.exp - b.exp);
  if (expGap >= 5)
    context_notes.push(
      `${a.exp > b.exp ? a.name : b.name} has ${expGap} more seasons of track record; the younger player's curve is still bending.`,
    );
  if (a.pos !== b.pos)
    context_notes.push(
      `Cross-position call (${a.pos} vs ${b.pos}) — rebounds, assists, and blocks don't translate one-to-one across roles.`,
    );
  const usgGap = Math.abs(a.usg - b.usg);
  if (usgGap >= 6) {
    const heavy = a.usg > b.usg ? a : b;
    const light = heavy.id === a.id ? b : a;
    context_notes.push(
      `${heavy.name} carries a much heavier offensive load (${heavy.usg} vs ${light.usg} usage) — efficiency gaps partly reflect role, not skill.`,
    );
  }
  if (lens !== "overall")
    context_notes.push(`Scored through the ${lens} lens only — the overall picture can flip the call.`);
  if (context_notes.length === 0)
    context_notes.push(
      "Same position, similar age and role — about as clean as one-on-one comparisons get.",
    );

  // Confidence: |edge| 0 -> 50 (coin flip), |edge| 100 -> 95 (decisive).
  const confidence_score = Math.round(50 + (Math.abs(edge) / 100) * 45);

  return {
    a: { player: a, points: makeCase(a, b) },
    b: { player: b, points: makeCase(b, a) },
    verdict,
    edge,
    context_notes,
    confidence_score,
  };
}

// News Sentiment lives in src/app/tools/news-sentiment — it now derives a real
// per-game momentum signal from the playoff shot data (lib/data/shots#playerForm)
// rather than a synthetic series, so no engine helper is needed here.

// ---------------- RecruitRank ----------------
export interface RecruitInput {
  name: string;
  ppg: number;
  rpg: number;
  apg: number;
  heightIn: number;
  position: string;
  level: "Varsity" | "AAU" | "Prep";
}
export interface CollegeFit {
  tier: string;
  why: string;
}
export interface RecruitResult {
  stars: number;
  grade: number;
  nationalRank: number;
  comp: string;
  report: string;
  attributes: { label: string; value: number }[];
  college_fit_suggestions: CollegeFit[]; // three program tiers, each with a reason
  development_plan: string[]; // three items built from the weakest attributes
}

// Fixed drill plans keyed by attribute — the three weakest attributes pick from here.
const DEV_PLAN: Record<string, (v: number) => string> = {
  Scoring: (v) =>
    `Scoring (${Math.round(v)}/100): add a pull-up counter and a 200-make daily shooting routine.`,
  Rebounding: (v) =>
    `Rebounding (${Math.round(v)}/100): box-out film work plus contact-finishing reps every practice.`,
  Playmaking: (v) =>
    `Playmaking (${Math.round(v)}/100): live pick-and-roll reads and two ball-handling circuits a week.`,
  Size: (v) =>
    `Size (${Math.round(v)}/100): strength program to play bigger — base, core, and leverage work.`,
  Motor: (v) =>
    `Motor (${Math.round(v)}/100): conditioning benchmarks and full-speed defensive shell drills.`,
};

export function recruitRank(i: RecruitInput): RecruitResult {
  const prod = i.ppg * 1.4 + i.rpg * 1.6 + i.apg * 2.2;
  const sizeBonus = clamp((i.heightIn - 72) * 1.4, -6, 16);
  const levelMult = i.level === "Prep" ? 1.12 : i.level === "AAU" ? 1.05 : 1.0;
  const grade = clamp((prod + sizeBonus) * levelMult + 28, 30, 99);
  const stars = grade >= 92 ? 5 : grade >= 84 ? 4 : grade >= 72 ? 3 : grade >= 58 ? 2 : 1;
  const nationalRank = Math.max(1, Math.round((100 - grade) * 9));
  const comps = ["a high-feel lead guard", "a two-way wing", "a modern stretch forward", "a switchable big"];
  const comp = comps[i.heightIn > 80 ? 3 : i.apg > 5 ? 0 : i.ppg > 18 ? 1 : 2];
  const report = `${i.name} profiles as ${comp} with ${i.ppg}/${i.rpg}/${i.apg} production at the ${i.level.toLowerCase()} level. ${
    stars >= 4 ? "High-major recruiters should prioritize an evaluation." : "A mid-major fit with developmental upside."
  }`;
  const attributes = [
    { label: "Scoring", value: clamp(i.ppg * 3.2, 0, 100) },
    { label: "Rebounding", value: clamp(i.rpg * 6, 0, 100) },
    { label: "Playmaking", value: clamp(i.apg * 9, 0, 100) },
    { label: "Size", value: clamp((i.heightIn - 66) * 4, 0, 100) },
    { label: "Motor", value: clamp(grade * 0.8 + 10, 0, 100) },
  ];

  const strongest = attributes.reduce((m, x) => (x.value > m.value ? x : m), attributes[0]);
  const g = Math.round(grade);
  const college_fit_suggestions: CollegeFit[] =
    g >= 88
      ? [
          {
            tier: "Blue-blood / top-10 program",
            why: `A ${g} grade with ${strongest.label.toLowerCase()} as the carrying tool plays at the highest level immediately.`,
          },
          {
            tier: "High-major starter",
            why: "Day-one rotation minutes with a featured role by year two — the safest development path.",
          },
          {
            tier: "Elite mid-major feature",
            why: "Maximum usage from the opening tip; the fastest route to a pro evaluation.",
          },
        ]
      : g >= 72
        ? [
            {
              tier: "High-major rotation",
              why: `The ${g} grade projects bench minutes early, with ${strongest.label.toLowerCase()} as the ticket to a bigger role.`,
            },
            {
              tier: "Mid-major starter",
              why: "Starts as a freshman and grows into a featured option by year two.",
            },
            {
              tier: "Low-major feature",
              why: "A go-to role from day one builds the tape for a transfer-up window.",
            },
          ]
        : [
            {
              tier: "Mid-major development",
              why: `A ${g} grade earns a development spot; a redshirt year closes the physical gap.`,
            },
            {
              tier: "Low-major / D2 starter",
              why: "Real minutes now beat bench minutes at a bigger program for this profile.",
            },
            {
              tier: "JUCO / prep year",
              why: "A bridge season to add production and re-enter recruiting with leverage.",
            },
          ];

  const development_plan = [...attributes]
    .sort((x, y) => x.value - y.value)
    .slice(0, 3)
    .map((a) => DEV_PLAN[a.label](a.value));

  return {
    stars,
    grade: g,
    nationalRank,
    comp,
    report,
    attributes,
    college_fit_suggestions,
    development_plan,
  };
}

// ---------------- IQ Quiz ----------------
export interface QuizQuestion {
  q: string;
  scenario: string;
  options: string[];
  correct: number;
  explain: string;
  category: string; // concept bucket used to aggregate misses
}
export const QUIZ: QuizQuestion[] = [
  {
    q: "Defensive coverage read",
    scenario: "You're guarding a non-shooting center on a high pick-and-roll. The ball-handler is an elite scorer.",
    options: ["Switch everything", "Drop coverage", "Hard hedge and recover", "Blitz the ball"],
    correct: 1,
    explain: "Drop coverage walls off the rim and dares the non-shooting big to pop — the safest read against an elite handler.",
    category: "Pick-and-roll coverage",
  },
  {
    q: "Spacing principle",
    scenario: "Your star is isolating on the right wing. Where should the weak-side corner shooter stand?",
    options: ["Crash baseline", "Lift to the wing", "Stay in the corner", "Cut to the dunker spot"],
    correct: 2,
    explain: "Staying in the corner stretches the help defender farthest from the ball, maximizing driving lanes.",
    category: "Spacing & off-ball play",
  },
  {
    q: "Late-clock decision",
    scenario: "5 seconds left on the shot clock, you catch at the top with a closeout coming.",
    options: ["Hold for a better look", "One-dribble pull-up", "Swing it cross-court", "Drive into traffic"],
    correct: 1,
    explain: "With the closeout flying and time short, attacking the closeout for a one-dribble pull-up is the highest-EV look.",
    category: "Shot selection",
  },
  {
    q: "Transition defense",
    scenario: "You miss a shot and the other team grabs it 3-on-2. You're the first man back.",
    options: ["Foul immediately", "Protect the rim", "Pick up the ball", "Tag the trailer"],
    correct: 1,
    explain: "First man back protects the rim and forces a pass; stopping the ball is the second defender's job.",
    category: "Transition defense",
  },
  {
    q: "Rebounding position",
    scenario: "A corner three goes up from the left side. Where does the long rebound most often go?",
    options: ["Same-side corner", "Opposite elbow", "Straight back to shooter", "Top of the key"],
    correct: 1,
    explain: "Misses tend to carom to the opposite-side elbow/wing — box out there for the long rebound.",
    category: "Rebounding",
  },
  {
    q: "Help rotation",
    scenario: "Baseline drive beats your teammate. You're the low man on the weak side.",
    options: ["Stay home", "Rotate to the rim", "Double the ball up top", "Foul the driver"],
    correct: 1,
    explain: "The low man rotates to stop the ball at the rim; the next pass triggers an X-out closeout behind you.",
    category: "Help rotations",
  },
];

// Fixed study topics keyed by concept — recommended when that concept is missed.
const NEXT_TOPIC: Record<string, string> = {
  "Pick-and-roll coverage":
    "Drop vs. hedge vs. switch rules — when each coverage wins against elite handlers.",
  "Spacing & off-ball play":
    "Corner spacing and the half-second decision rule for weak-side shooters.",
  "Shot selection":
    "Late-clock shot math — why attacking a closeout beats holding for a contested look.",
  "Transition defense":
    "First-man-back priorities: protect the rim, force the pass, trust the second defender.",
  Rebounding: "Long-rebound geometry — where misses carom by shot location.",
  "Help rotations": "Low-man rules and the X-out closeout chain behind a baseline drive.",
};

export interface QuizSummary {
  score: number;
  total: number;
  pct: number;
  best_streak: number; // longest run of consecutive correct answers
  missed_concepts: { category: string; count: number }[]; // wrong answers grouped by concept
  recommended_next_topics: string[]; // study topics for the most-missed concepts
}

/** Grade an answer sheet (index per question, null = unanswered) against QUIZ. */
export function quizResults(answers: ReadonlyArray<number | null>): QuizSummary {
  let score = 0;
  let streak = 0;
  let best_streak = 0;
  const missed = new Map<string, number>();
  QUIZ.forEach((q, i) => {
    if (answers[i] === q.correct) {
      score += 1;
      streak += 1;
      if (streak > best_streak) best_streak = streak;
    } else {
      streak = 0;
      missed.set(q.category, (missed.get(q.category) ?? 0) + 1);
    }
  });
  const missed_concepts = [...missed.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((x, y) => y.count - x.count || x.category.localeCompare(y.category));
  const recommended_next_topics = missed_concepts
    .slice(0, 3)
    .map((m) => NEXT_TOPIC[m.category])
    .filter((t): t is string => Boolean(t));
  return {
    score,
    total: QUIZ.length,
    pct: Math.round((score / QUIZ.length) * 100),
    best_streak,
    missed_concepts,
    recommended_next_topics,
  };
}
