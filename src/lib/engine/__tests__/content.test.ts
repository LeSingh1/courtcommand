import { describe, it, expect } from "vitest";
import {
  draftRecommend,
  rosterNeeds,
  simulateMatchup,
  simulateBracket,
  recruitRank,
  quizResults,
  debate,
  QUIZ,
  type NcaaTeam,
  type DraftRecommendation,
} from "@/lib/engine/content";
import { PLAYERS } from "@/lib/data";

// ---------------- draftRecommend ----------------
describe("draftRecommend", () => {
  // Roster archetypes built from real data: playmakers (assist-heavy, block-light)
  // and rim-protecting centers (block-heavy, assist-light).
  const playmakers = [...PLAYERS].sort((a, b) => b.apg - a.apg).slice(0, 3);
  const bigs = [...PLAYERS]
    .filter((p) => p.pos === "C")
    .sort((a, b) => b.bpg - a.bpg)
    .slice(0, 3);
  const rosteredIds = new Set([...playmakers, ...bigs].map((p) => p.id));
  const blocker = [...PLAYERS]
    .filter((p) => p.pos === "C" && !rosteredIds.has(p.id))
    .sort((a, b) => b.bpg - a.bpg)[0];
  const passer = [...PLAYERS]
    .filter((p) => !rosteredIds.has(p.id) && p.id !== blocker.id)
    .sort((a, b) => b.apg - a.apg)[0];

  const fitOf = (recs: DraftRecommendation[], id: string) =>
    recs.find((r) => r.player.id === id)!.fit_score;

  it("fills the weakest category: a shot-blocker fits a playmaker roster better than another passer", () => {
    const needs = rosterNeeds(playmakers, "none");
    // A roster of the league's top passers should not be needy in assists.
    expect(needs[needs.length - 1].cat).toBe("ast");
    const recs = draftRecommend(playmakers, new Set(), "none");
    expect(fitOf(recs, blocker.id)).toBeGreaterThan(fitOf(recs, passer.id));
  });

  it("flips fit ordering when the roster flips: passers fit a big-heavy roster better", () => {
    const recsBig = draftRecommend(bigs, new Set(), "none");
    const recsGuard = draftRecommend(playmakers, new Set(), "none");
    expect(fitOf(recsBig, passer.id)).toBeGreaterThan(fitOf(recsGuard, passer.id));
    expect(fitOf(recsGuard, blocker.id)).toBeGreaterThan(fitOf(recsBig, blocker.id));
  });

  it("excludes drafted and rostered players, ranks by composite score, and explains each pick", () => {
    const drafted = new Set([blocker.id, passer.id]);
    const recs = draftRecommend(playmakers, drafted, "none");
    expect(recs.some((r) => drafted.has(r.player.id))).toBe(false);
    expect(recs.some((r) => playmakers.some((p) => p.id === r.player.id))).toBe(false);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
    for (const r of recs.slice(0, 5)) {
      expect(r.reasoning.length).toBeGreaterThan(20);
      expect(r.fit_score).toBeGreaterThanOrEqual(0);
      expect(r.fit_score).toBeLessThanOrEqual(100);
      expect(r.scarcity_score).toBeGreaterThanOrEqual(0);
      expect(r.scarcity_score).toBeLessThanOrEqual(100);
      expect(r.risk_score).toBeGreaterThanOrEqual(0);
      expect(r.risk_score).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------- simulateMatchup ----------------
describe("simulateMatchup", () => {
  const mk = (over: Partial<NcaaTeam>): NcaaTeam => ({
    name: "T",
    seed: 4,
    eff: 20,
    sos: 6,
    form: 0.7,
    color: "#000000",
    ...over,
  });

  it("favors the higher-efficiency team in probability and projected score", () => {
    const m = simulateMatchup(mk({ name: "Strong", eff: 26 }), mk({ name: "Weak", eff: 14 }));
    expect(m.win_probability).toBeGreaterThan(50);
    expect(m.projected_score.a).toBeGreaterThan(m.projected_score.b);
    expect(m.key_factors).toHaveLength(2);
    expect(m.key_factors[0].label).toBe("Net efficiency");
    expect(m.key_factors[0].favors).toBe("Strong");
  });

  it("projects an efficiency-scaled score around a 70-possession game", () => {
    const m = simulateMatchup(mk({ name: "A" }), mk({ name: "B" }));
    expect(m.projected_score.a).toBe(m.projected_score.b); // identical inputs tie
    expect(m.projected_score.a).toBeGreaterThanOrEqual(70);
    expect(m.projected_score.a).toBeLessThanOrEqual(85);
    expect(m.win_probability).toBe(50);
  });

  it("flags upset risk when the seeds invert (better team carries the worse seed)", () => {
    const m = simulateMatchup(
      mk({ name: "Dog", seed: 11, eff: 24, form: 0.85 }),
      mk({ name: "Fav", seed: 2, eff: 17, form: 0.55 }),
    );
    expect(m.win_probability).toBeGreaterThan(50); // worse seed predicted to win
    expect(m.upset_risk).toBeGreaterThanOrEqual(50);

    const chalk = simulateMatchup(
      mk({ name: "One", seed: 1, eff: 28 }),
      mk({ name: "Eight", seed: 8, eff: 16 }),
    );
    expect(chalk.upset_risk).toBeLessThan(50);
  });

  it("keeps simulateBracket deterministic", () => {
    const r1 = simulateBracket("balanced");
    const r2 = simulateBracket("balanced");
    expect(r1.champion.name).toBe(r2.champion.name);
    expect(r1.rounds.flat().map((g) => g.winner.name)).toEqual(
      r2.rounds.flat().map((g) => g.winner.name),
    );
  });
});

// ---------------- recruitRank ----------------
describe("recruitRank", () => {
  it("builds the development plan from the three lowest attributes, in order", () => {
    const r = recruitRank({
      name: "Test Prospect",
      ppg: 25,
      rpg: 2,
      apg: 1,
      heightIn: 70,
      position: "SG",
      level: "Varsity",
    });
    expect(r.development_plan).toHaveLength(3);
    const lowest = [...r.attributes].sort((a, b) => a.value - b.value).slice(0, 3);
    lowest.forEach((attr, i) => {
      expect(r.development_plan[i]).toContain(attr.label);
    });
  });

  it("returns three college-fit tiers with reasons, scaled to the grade", () => {
    const elite = recruitRank({
      name: "Elite",
      ppg: 32,
      rpg: 10,
      apg: 8,
      heightIn: 80,
      position: "SF",
      level: "Prep",
    });
    const modest = recruitRank({
      name: "Modest",
      ppg: 8,
      rpg: 3,
      apg: 1,
      heightIn: 70,
      position: "PG",
      level: "Varsity",
    });
    expect(elite.college_fit_suggestions).toHaveLength(3);
    expect(modest.college_fit_suggestions).toHaveLength(3);
    for (const f of [...elite.college_fit_suggestions, ...modest.college_fit_suggestions]) {
      expect(f.tier.length).toBeGreaterThan(0);
      expect(f.why.length).toBeGreaterThan(10);
    }
    expect(elite.grade).toBeGreaterThan(modest.grade);
    expect(elite.college_fit_suggestions[0].tier).not.toBe(modest.college_fit_suggestions[0].tier);
  });
});

// ---------------- quizResults ----------------
describe("quizResults", () => {
  it("groups misses by category, recommends matching topics, and tracks the best streak", () => {
    const answers = QUIZ.map((q) => q.correct as number | null);
    answers[0] = (QUIZ[0].correct + 1) % QUIZ[0].options.length;
    answers[3] = (QUIZ[3].correct + 1) % QUIZ[3].options.length;
    const s = quizResults(answers);
    expect(s.score).toBe(QUIZ.length - 2);
    expect(s.missed_concepts.map((m) => m.category).sort()).toEqual(
      [QUIZ[0].category, QUIZ[3].category].sort(),
    );
    s.missed_concepts.forEach((m) => expect(m.count).toBe(1));
    expect(s.recommended_next_topics).toHaveLength(2);
    s.recommended_next_topics.forEach((t) => expect(t.length).toBeGreaterThan(10));
    // misses at 0 and 3 leave runs of two correct answers each
    expect(s.best_streak).toBe(2);
  });

  it("a perfect run has no missed concepts and a full streak", () => {
    const s = quizResults(QUIZ.map((q) => q.correct));
    expect(s.missed_concepts).toEqual([]);
    expect(s.recommended_next_topics).toEqual([]);
    expect(s.best_streak).toBe(QUIZ.length);
    expect(s.pct).toBe(100);
  });

  it("unanswered questions count as misses", () => {
    const s = quizResults([]);
    expect(s.score).toBe(0);
    expect(s.missed_concepts.reduce((a, m) => a + m.count, 0)).toBe(QUIZ.length);
    expect(s.recommended_next_topics.length).toBeLessThanOrEqual(3);
  });
});

// ---------------- debate ----------------
describe("debate", () => {
  const byStar = [...PLAYERS].sort((a, b) => b.starPower - a.starPower);
  const star = byStar[0];
  const scrub = byStar[byStar.length - 1];

  it("returns a helpful error string when either player is missing or vague", () => {
    expect(typeof debate("", star.id)).toBe("string");
    expect(typeof debate(star.id, "")).toBe("string");
    expect(typeof debate(star.id, "not-a-real-id")).toBe("string");
    const msg = debate("nobody-here", "also-nobody");
    expect(typeof msg).toBe("string");
    expect((msg as string).length).toBeGreaterThan(10);
    expect(typeof debate(star.id, star.id)).toBe("string");
  });

  it("confidence scales with the size of the edge and stays within 50-95", () => {
    const big = debate(star.id, scrub.id);
    const mid = Math.floor(byStar.length / 2);
    const close = debate(byStar[mid].id, byStar[mid + 1].id);
    expect(typeof big).toBe("object");
    expect(typeof close).toBe("object");
    if (typeof big === "string" || typeof close === "string") throw new Error("unexpected");

    // confidence is the documented mapping of |edge|: 0 -> 50, 100 -> 95
    expect(big.confidence_score).toBe(Math.round(50 + (Math.abs(big.edge) / 100) * 45));
    expect(close.confidence_score).toBe(Math.round(50 + (Math.abs(close.edge) / 100) * 45));
    expect(Math.abs(big.edge)).toBeGreaterThan(Math.abs(close.edge));
    expect(big.confidence_score).toBeGreaterThan(close.confidence_score);
    for (const r of [big, close]) {
      expect(r.confidence_score).toBeGreaterThanOrEqual(50);
      expect(r.confidence_score).toBeLessThanOrEqual(95);
      expect(r.context_notes.length).toBeGreaterThan(0);
      r.context_notes.forEach((n) => expect(typeof n).toBe("string"));
    }
  });
});
