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

export function fantasyBoard(punt: PuntCategory = "none"): FantasyRow[] {
  // 9-cat-ish z-scores from the player pool
  const mean = (f: (p: Player) => number) => PLAYERS.reduce((a, p) => a + f(p), 0) / PLAYERS.length;
  const std = (f: (p: Player) => number, m: number) =>
    Math.sqrt(PLAYERS.reduce((a, p) => a + (f(p) - m) ** 2, 0) / PLAYERS.length) || 1;
  const z = (f: (p: Player) => number) => {
    const m = mean(f);
    const sd = std(f, m);
    return (p: Player) => (f(p) - m) / sd;
  };
  const zp = z((p) => p.ppg);
  const zr = z((p) => p.rpg);
  const za = z((p) => p.apg);
  const zs = z((p) => p.spg);
  const zb = z((p) => p.bpg);
  const z3 = z((p) => p.tpa * p.tpp);
  const zfg = z((p) => p.fgp);
  const zft = z((p) => p.ftp);
  const zto = z((p) => -p.topg);

  const rows = PLAYERS.map((p) => {
    const parts: Record<string, number> = {
      pts: zp(p),
      reb: zr(p),
      ast: za(p),
      stl: zs(p),
      blk: zb(p),
      threes: z3(p),
      fg: zfg(p),
      ft: zft(p),
      to: zto(p),
    };
    if (punt !== "none" && parts[punt] !== undefined) parts[punt] = 0;
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
  }).sort((a, b) => b.zScore - a.zScore);
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.scarcity = Math.round(clamp((r.player.pos === "C" ? 70 : r.player.pos === "PG" ? 55 : 45) + r.player.bpg * 6, 0, 100));
  });
  return rows;
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

function winProb(a: NcaaTeam, b: NcaaTeam, emphasis: BracketEmphasis = "balanced"): number {
  const w =
    emphasis === "efficiency"
      ? { eff: 1.35, sos: 0.5, form: 4, seed: 0.7 }
      : emphasis === "form"
        ? { eff: 0.7, sos: 0.3, form: 16, seed: 0.45 }
        : { eff: 1, sos: 0.4, form: 8, seed: 0.6 };
  const edge =
    (a.eff - b.eff) * w.eff +
    (a.sos - b.sos) * w.sos +
    (a.form - b.form) * w.form +
    (b.seed - a.seed) * w.seed;
  return clamp(1 / (1 + Math.exp(-edge / 7)), 0.05, 0.95);
}

export interface BracketGame {
  round: number;
  a: NcaaTeam;
  b: NcaaTeam;
  aProb: number;
  winner: NcaaTeam;
  upset: boolean;
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
}
export function debate(idA: string, idB: string, lens: "offense" | "defense" | "overall" = "overall"): DebateResult | null {
  const a = getPlayer(idA);
  const b = getPlayer(idB);
  if (!a || !b) return null;
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
  const edge = clamp(((sa - sb) / (sa + sb)) * 200, -100, 100);
  const verdict =
    Math.abs(edge) < 6
      ? `Statistically a coin-flip in the ${lens} lens — comes down to context and role.`
      : `${edge > 0 ? a.name : b.name} holds the edge in the ${lens} lens by the numbers.`;
  return { a: { player: a, points: makeCase(a, b) }, b: { player: b, points: makeCase(b, a) }, verdict, edge: Math.round(edge) };
}

// ---------------- News Sentiment ----------------
export interface SentimentPoint {
  week: string;
  score: number; // -100..100
  volume: number;
}
export interface SentimentResult {
  series: SentimentPoint[];
  current: number;
  trend: "rising" | "cooling" | "steady";
  headlines: { text: string; tone: number }[];
}
export function newsSentiment(p: Player): SentimentResult {
  let s = p.name.length * 7 + Math.round(p.ppg);
  const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  const series: SentimentPoint[] = [];
  let cur = (p.starPower - 50) * 0.8;
  for (let w = 1; w <= 10; w++) {
    cur = clamp(cur + (rnd() - 0.5) * 36, -90, 90);
    series.push({ week: `W${w}`, score: Math.round(cur), volume: Math.round(30 + rnd() * 70) });
  }
  const current = series[series.length - 1].score;
  const prev = series[series.length - 3].score;
  const trend = current - prev > 8 ? "rising" : current - prev < -8 ? "cooling" : "steady";
  const pos = [
    `${p.name} is playing the best ball of the season`,
    `Analysts praise ${p.name}'s two-way leap`,
    `${p.name} carries ${p.team} to a statement win`,
  ];
  const neg = [
    `Questions mount about ${p.name}'s shot selection`,
    `${p.name}'s availability sparks load-management debate`,
    `${p.team} offense stalls when ${p.name} sits`,
  ];
  const headlines = series.slice(-4).map((pt) => ({
    text: pt.score >= 0 ? pos[pt.volume % pos.length] : neg[pt.volume % neg.length],
    tone: pt.score,
  }));
  return { series, current, trend, headlines };
}

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
export interface RecruitResult {
  stars: number;
  grade: number;
  nationalRank: number;
  comp: string;
  report: string;
  attributes: { label: string; value: number }[];
}
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
  return {
    stars,
    grade: Math.round(grade),
    nationalRank,
    comp,
    report,
    attributes: [
      { label: "Scoring", value: clamp(i.ppg * 3.2, 0, 100) },
      { label: "Rebounding", value: clamp(i.rpg * 6, 0, 100) },
      { label: "Playmaking", value: clamp(i.apg * 9, 0, 100) },
      { label: "Size", value: clamp((i.heightIn - 66) * 4, 0, 100) },
      { label: "Motor", value: clamp(grade * 0.8 + 10, 0, 100) },
    ],
  };
}

// ---------------- IQ Quiz ----------------
export interface QuizQuestion {
  q: string;
  scenario: string;
  options: string[];
  correct: number;
  explain: string;
}
export const QUIZ: QuizQuestion[] = [
  {
    q: "Defensive coverage read",
    scenario: "You're guarding a non-shooting center on a high pick-and-roll. The ball-handler is an elite scorer.",
    options: ["Switch everything", "Drop coverage", "Hard hedge and recover", "Blitz the ball"],
    correct: 1,
    explain: "Drop coverage walls off the rim and dares the non-shooting big to pop — the safest read against an elite handler.",
  },
  {
    q: "Spacing principle",
    scenario: "Your star is isolating on the right wing. Where should the weak-side corner shooter stand?",
    options: ["Crash baseline", "Lift to the wing", "Stay in the corner", "Cut to the dunker spot"],
    correct: 2,
    explain: "Staying in the corner stretches the help defender farthest from the ball, maximizing driving lanes.",
  },
  {
    q: "Late-clock decision",
    scenario: "5 seconds left on the shot clock, you catch at the top with a closeout coming.",
    options: ["Hold for a better look", "One-dribble pull-up", "Swing it cross-court", "Drive into traffic"],
    correct: 1,
    explain: "With the closeout flying and time short, attacking the closeout for a one-dribble pull-up is the highest-EV look.",
  },
  {
    q: "Transition defense",
    scenario: "You miss a shot and the other team grabs it 3-on-2. You're the first man back.",
    options: ["Foul immediately", "Protect the rim", "Pick up the ball", "Tag the trailer"],
    correct: 1,
    explain: "First man back protects the rim and forces a pass; stopping the ball is the second defender's job.",
  },
  {
    q: "Rebounding position",
    scenario: "A corner three goes up from the left side. Where does the long rebound most often go?",
    options: ["Same-side corner", "Opposite elbow", "Straight back to shooter", "Top of the key"],
    correct: 1,
    explain: "Misses tend to carom to the opposite-side elbow/wing — box out there for the long rebound.",
  },
  {
    q: "Help rotation",
    scenario: "Baseline drive beats your teammate. You're the low man on the weak side.",
    options: ["Stay home", "Rotate to the rim", "Double the ball up top", "Foul the driver"],
    correct: 1,
    explain: "The low man rotates to stop the ball at the rim; the next pass triggers an X-out closeout behind you.",
  },
];
