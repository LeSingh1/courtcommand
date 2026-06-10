import { describe, it, expect } from "vitest";
import type { Player } from "@/lib/types";
import {
  evaluateProp,
  optimizeLineup,
  kellyFraction,
  confidenceTier,
  consistencyScore,
  skillBalance,
  trainingBadges,
  weeklySummary,
  KELLY_CAP,
  BADGE_THRESHOLDS,
  MARKETS,
  type ConfidenceTier,
  type LineupPick,
  type TrainingSession,
} from "@/lib/engine/betting";

const BASE: Player = {
  id: "test-player",
  name: "Test Player",
  team: "BOS",
  pos: "SG",
  age: 26,
  htIn: 78,
  wtLb: 210,
  exp: 5,
  salary: 20,
  gp: 70,
  mpg: 30,
  ppg: 18,
  rpg: 5,
  apg: 4,
  spg: 1.1,
  bpg: 0.5,
  topg: 2.2,
  fgp: 0.47,
  tpp: 0.36,
  ftp: 0.8,
  tpa: 6,
  usg: 24,
  tsp: 0.58,
  per: 18,
  bpm: 2,
  netRtg: 2,
  shotRim: 0.3,
  shotMid: 0.3,
  shotThree: 0.4,
  clutchPpg: 2.8,
  clutchFgp: 0.45,
  clutchUsg: 25,
  defReb: 3,
  defImpact: 50,
  offImpact: 55,
  injuryRisk: 40,
  ortg: 112,
  drtg: 112,
  archetype: "Combo Guard",
  starPower: 55,
  efficiency: 60,
};

const mk = (over: Partial<Player>): Player => ({ ...BASE, ...over });

const pick = (prop: ReturnType<typeof evaluateProp>): LineupPick => ({
  prop,
  side: prop.side,
  prob: prop.pSide,
});

describe("kellyFraction", () => {
  it("grows with edge at fixed implied odds", () => {
    const f1 = kellyFraction(0.51, 0.5);
    const f2 = kellyFraction(0.52, 0.5);
    const f3 = kellyFraction(0.54, 0.5);
    expect(f1).toBeGreaterThan(0);
    expect(f2).toBeGreaterThan(f1);
    expect(f3).toBeGreaterThan(f2);
  });

  it("caps at KELLY_CAP no matter how big the edge", () => {
    expect(kellyFraction(0.55, 0.5)).toBe(KELLY_CAP);
    expect(kellyFraction(0.8, 0.5)).toBe(KELLY_CAP);
    expect(kellyFraction(0.92, 0.4)).toBe(KELLY_CAP);
    // never increases past the cap
    let prev = 0;
    for (let p = 0.5; p <= 0.92; p += 0.02) {
      const f = kellyFraction(p, 0.5);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeLessThanOrEqual(KELLY_CAP);
      prev = f;
    }
  });

  it("floors at zero for negative-edge picks", () => {
    expect(kellyFraction(0.45, 0.5)).toBe(0);
    expect(kellyFraction(0.5, 0.588)).toBe(0);
  });

  it("is attached to every evaluated prop within [0, cap]", () => {
    const p = mk({});
    for (const m of MARKETS) {
      for (const ot of ["standard", "demon", "goblin"] as const) {
        const e = evaluateProp(p, m, ot);
        expect(e.kellyFraction).toBeGreaterThanOrEqual(0);
        expect(e.kellyFraction).toBeLessThanOrEqual(KELLY_CAP);
      }
    }
  });
});

describe("confidenceTier", () => {
  const rank: Record<ConfidenceTier, number> = { A: 3, B: 2, C: 1 };

  it("orders tiers A > B > C by edge at fixed volatility", () => {
    expect(confidenceTier(0.1, 4, 20)).toBe("A");
    expect(confidenceTier(0.05, 4, 20)).toBe("B");
    expect(confidenceTier(0.01, 4, 20)).toBe("C");
  });

  it("never lowers the tier as edge grows (fixed sigma/projection)", () => {
    let prev = 0;
    for (let edge = 0; edge <= 0.2; edge += 0.005) {
      const r = rank[confidenceTier(edge, 4, 20)];
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it("never raises the tier as sigma grows (fixed edge/projection)", () => {
    let prev = 3;
    for (let sd = 2; sd <= 20; sd += 1) {
      const r = rank[confidenceTier(0.1, sd, 20)];
      expect(r).toBeLessThanOrEqual(prev);
      prev = r;
    }
    // a big edge on a very noisy market is still a C
    expect(confidenceTier(0.15, 16, 20)).toBe("C");
  });

  it("is attached to every evaluated prop", () => {
    const e = evaluateProp(mk({}), "PTS");
    expect(["A", "B", "C"]).toContain(e.confidenceTier);
  });
});

describe("optimizeLineup correlation handling", () => {
  it("flags a same-player multi-market slip and discounts the all-hit probability", () => {
    const p = mk({ id: "stack-guy", name: "Stack Guy" });
    const picks = [pick(evaluateProp(p, "PTS")), pick(evaluateProp(p, "PRA"))];
    const res = optimizeLineup(picks, "power", 10)!;
    expect(res.correlationRisk).toBe("high");
    expect(res.correlationWarning).not.toBeNull();
    expect(res.correlationWarning).toContain("Stack Guy");
    expect(res.correlationWarning).toContain("PTS");
    expect(res.correlationWarning).toContain("PRA");
    expect(res.hitProbAdjusted).toBeLessThan(res.hitProbAll);
  });

  it("leaves an uncorrelated slip unflagged with no probability discount", () => {
    const a = mk({ id: "player-a", name: "Player A", team: "BOS" });
    const b = mk({ id: "player-b", name: "Player B", team: "LAL" });
    const picks = [pick(evaluateProp(a, "PTS")), pick(evaluateProp(b, "REB"))];
    const res = optimizeLineup(picks, "power", 10)!;
    expect(res.correlationRisk).toBe("low");
    expect(res.correlationWarning).toBeNull();
    expect(res.hitProbAdjusted).toBe(res.hitProbAll);
  });

  it("pays less EV on the correlated version of the same probabilities", () => {
    const p = mk({ id: "stack-guy", name: "Stack Guy" });
    const a = mk({ id: "solo-a", name: "Solo A", team: "BOS" });
    const b = mk({ id: "solo-b", name: "Solo B", team: "LAL" });
    const correlated = optimizeLineup(
      [pick(evaluateProp(p, "PTS")), pick(evaluateProp(p, "PRA"))],
      "power",
      10,
    )!;
    // same chosen probabilities, but on independent players
    const probs = correlated.picks.map((x) => x.prob);
    const uncorr = optimizeLineup(
      [
        { ...pick(evaluateProp(a, "PTS")), prob: probs[0] },
        { ...pick(evaluateProp(b, "PTS")), prob: probs[1] },
      ],
      "power",
      10,
    )!;
    expect(correlated.expectedValue).toBeLessThan(uncorr.expectedValue);
  });
});

// ---------------- Training tracker math ----------------

const sess = (day: string, type: string, reps: number, minutes: number): TrainingSession => ({
  day,
  type,
  reps,
  minutes,
});

const WEEK: TrainingSession[] = [
  sess("Mon", "Shooting", 240, 55),
  sess("Tue", "Conditioning", 0, 40),
  sess("Wed", "Skills", 160, 50),
  sess("Thu", "Strength", 90, 45),
  sess("Fri", "Shooting", 300, 60),
];

describe("consistencyScore", () => {
  it("is active days / 7 as a 0-100 score", () => {
    expect(consistencyScore(WEEK)).toBe(Math.round((5 / 7) * 100)); // 71
    expect(
      consistencyScore(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => sess(d, "Skills", 50, 30))),
    ).toBe(100);
    expect(consistencyScore([])).toBe(0);
  });

  it("counts a day once even with multiple sessions logged on it", () => {
    const doubled = [sess("Mon", "Shooting", 200, 60), sess("Mon", "Strength", 80, 40)];
    expect(consistencyScore(doubled)).toBe(Math.round((1 / 7) * 100)); // 14
  });
});

describe("skillBalance", () => {
  it("scores 100 for minutes split evenly across all four types", () => {
    const even = [
      sess("Mon", "Shooting", 100, 60),
      sess("Tue", "Conditioning", 0, 60),
      sess("Wed", "Strength", 50, 60),
      sess("Thu", "Skills", 80, 60),
    ];
    expect(skillBalance(even)).toBe(100);
  });

  it("scores 0 for a single-type week and for an empty log", () => {
    expect(skillBalance([sess("Mon", "Shooting", 200, 60), sess("Tue", "Shooting", 250, 55)])).toBe(0);
    expect(skillBalance([])).toBe(0);
  });

  it("scores 50 for an even two-type split (entropy ln2 / ln4)", () => {
    const two = [sess("Mon", "Shooting", 100, 60), sess("Tue", "Strength", 50, 60)];
    expect(skillBalance(two)).toBe(50);
  });

  it("rewards a more even spread over a lopsided one", () => {
    const lopsided = [
      sess("Mon", "Shooting", 100, 120),
      sess("Tue", "Conditioning", 0, 20),
      sess("Wed", "Strength", 50, 20),
      sess("Thu", "Skills", 80, 20),
    ];
    expect(skillBalance(lopsided)).toBeLessThan(100);
    expect(skillBalance(lopsided)).toBeGreaterThan(0);
  });
});

describe("trainingBadges", () => {
  it("always returns the three badges in a stable order", () => {
    const ids = trainingBadges(WEEK).map((b) => b.id);
    expect(ids).toEqual(["volume", "streak", "balance"]);
  });

  it("earns volume exactly at the rep threshold, not below", () => {
    const at = [sess("Mon", "Shooting", BADGE_THRESHOLDS.volumeReps, 60)];
    const below = [sess("Mon", "Shooting", BADGE_THRESHOLDS.volumeReps - 1, 60)];
    expect(trainingBadges(at).find((b) => b.id === "volume")!.earned).toBe(true);
    expect(trainingBadges(below).find((b) => b.id === "volume")!.earned).toBe(false);
  });

  it("earns streak at five distinct active days, not four", () => {
    const five = ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => sess(d, "Skills", 50, 30));
    const four = five.slice(0, 4);
    expect(trainingBadges(five).find((b) => b.id === "streak")!.earned).toBe(true);
    expect(trainingBadges(four).find((b) => b.id === "streak")!.earned).toBe(false);
  });

  it("earns balance only above the balance-score threshold", () => {
    const even = [
      sess("Mon", "Shooting", 100, 60),
      sess("Tue", "Conditioning", 0, 60),
      sess("Wed", "Strength", 50, 60),
      sess("Thu", "Skills", 80, 60),
    ];
    const oneNote = [sess("Mon", "Shooting", 500, 120)];
    expect(trainingBadges(even).find((b) => b.id === "balance")!.earned).toBe(true);
    expect(trainingBadges(oneNote).find((b) => b.id === "balance")!.earned).toBe(false);
  });
});

describe("weeklySummary", () => {
  it("reads the real totals out of the log", () => {
    const line = weeklySummary(WEEK);
    expect(line).toContain("5 sessions");
    expect(line).toContain("5 of 7 days");
    expect(line).toContain("790"); // total reps
    expect(line).toContain("250 minutes");
    expect(line).toContain(`${skillBalance(WEEK)}/100`);
  });

  it("handles an empty log without inventing numbers", () => {
    expect(weeklySummary([])).toBe("No sessions logged yet this week.");
  });
});
