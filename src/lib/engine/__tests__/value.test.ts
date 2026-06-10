import { describe, it, expect } from "vitest";
import type { Player } from "@/lib/types";
import {
  contractBreakdown,
  underratedWhy,
  workloadRisk,
  projectSeasons,
  defensiveProfile,
  UNDERRATED_USAGE_CAP,
} from "@/lib/engine/value";

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

describe("contractBreakdown", () => {
  it("ranks a cheap productive player above an expensive low-impact one", () => {
    const cheapProductive = mk({
      id: "cheap",
      salary: 6,
      offImpact: 58,
      defImpact: 55,
      bpm: 2.5,
      gp: 74,
    });
    const expensiveLowImpact = mk({
      id: "pricey",
      salary: 45,
      offImpact: 30,
      defImpact: 35,
      bpm: -2,
      gp: 60,
    });
    const a = contractBreakdown(cheapProductive);
    const b = contractBreakdown(expensiveLowImpact);
    expect(a.bargainScore).toBeGreaterThan(b.bargainScore);
    expect(a.productionPerDollar).toBeGreaterThan(b.productionPerDollar);
  });

  it("applies an age-curve premium before 27 and a discount after", () => {
    const young = contractBreakdown(mk({ age: 22 }));
    const old = contractBreakdown(mk({ age: 34 }));
    expect(young.ageCurveFactor).toBeGreaterThan(1);
    expect(old.ageCurveFactor).toBeLessThan(1);
  });

  it("flags big salary into decline years as High risk with a reason", () => {
    const risky = contractBreakdown(mk({ salary: 48, age: 34, gp: 50 }));
    expect(risky.contractRisk.level).toBe("High");
    expect(risky.contractRisk.why.length).toBeGreaterThan(0);
    expect(risky.availability.note).toContain("games");
  });
});

describe("underratedWhy", () => {
  it("structurally excludes a 30-percent-usage star", () => {
    const star = mk({ usg: 30, ppg: 29, starPower: 92, salary: 50 });
    const profile = underratedWhy(star);
    expect(star.usg).toBeGreaterThanOrEqual(UNDERRATED_USAGE_CAP);
    expect(profile.eligible).toBe(false);
    expect(profile.whyUnderrated).toHaveLength(0);
    expect(profile.idealTeamFits).toHaveLength(0);
  });

  it("explains an efficient low-usage bargain and returns three team fits", () => {
    const sleeper = mk({ usg: 18, tsp: 0.62, salary: 8, defImpact: 62, netRtg: 5 });
    const profile = underratedWhy(sleeper);
    expect(profile.eligible).toBe(true);
    expect(profile.whyUnderrated.length).toBeGreaterThan(0);
    expect(profile.whyUnderrated.join(" ")).toContain("low usage");
    expect(profile.idealTeamFits).toHaveLength(3);
    for (const fit of profile.idealTeamFits) {
      expect(fit.team.abbr).not.toBe(sleeper.team);
      expect(fit.reasons.length).toBeGreaterThan(0);
    }
  });

  it("flags low-minute small samples", () => {
    const lowMin = mk({ usg: 16, mpg: 14, gp: 38 });
    const profile = underratedWhy(lowMin);
    expect(profile.smallSample).toBe(true);
    expect(profile.riskFactors.join(" ")).toContain("small sample");
  });
});

describe("workloadRisk", () => {
  it("rates a heavy-minutes older player high", () => {
    const veteran = mk({ age: 35, mpg: 37, gp: 50, usg: 32 });
    const risk = workloadRisk(veteran);
    expect(risk.overall).toBe("high");
    expect(risk.contributingFactors.length).toBeGreaterThan(0);
    expect(risk.recommendations.length).toBeGreaterThan(0);
  });

  it("rates a rested young player low", () => {
    const young = mk({ age: 22, mpg: 26, gp: 78, usg: 18 });
    const risk = workloadRisk(young);
    expect(risk.overall).toBe("low");
    expect(risk.workloadScore).toBeLessThan(30);
  });

  it("never uses diagnostic language in recommendations", () => {
    for (const p of [mk({ age: 35, mpg: 37, gp: 50 }), mk({ age: 22, mpg: 26, gp: 78 })]) {
      const risk = workloadRisk(p);
      const text = risk.recommendations.join(" ").toLowerCase();
      expect(text).not.toContain("injur");
      expect(text).not.toContain("diagnos");
      expect(text).not.toContain("medical");
    }
  });
});

describe("projectSeasons", () => {
  it("orders bands worst < expected < best for every season", () => {
    const proj = projectSeasons(mk({ age: 23, ppg: 16 }), 3);
    expect(proj.seasons).toHaveLength(3);
    for (const s of proj.seasons) {
      expect(s.worst.ppg).toBeLessThan(s.expected.ppg);
      expect(s.expected.ppg).toBeLessThan(s.best.ppg);
      expect(s.worst.composite).toBeLessThan(s.expected.composite);
      expect(s.expected.composite).toBeLessThan(s.best.composite);
    }
  });

  it("ages forward from the player's current age and returns three comparables", () => {
    const p = mk({ age: 24 });
    const proj = projectSeasons(p, 3);
    expect(proj.seasons.map((s) => s.age)).toEqual([25, 26, 27]);
    expect(proj.comparablePlayers).toHaveLength(3);
    for (const c of proj.comparablePlayers) expect(c.id).not.toBe(p.id);
    expect(proj.growthDrivers.length).toBeGreaterThan(0);
    expect(proj.riskFactors.length).toBeGreaterThan(0);
  });

  it("projects growth for a young efficient player and decline for an aging one", () => {
    const young = projectSeasons(mk({ age: 21, ppg: 15, tsp: 0.6, mpg: 26 }), 3);
    const old = projectSeasons(mk({ age: 33, ppg: 22, tsp: 0.55 }), 3);
    expect(young.seasons[2].expected.ppg).toBeGreaterThan(15);
    expect(old.seasons[2].expected.ppg).toBeLessThan(22);
  });
});

describe("defensiveProfile", () => {
  const big = mk({ pos: "C", bpg: 2.8, spg: 0.5, htIn: 85, rpg: 11, defReb: 8, mpg: 32 });
  const guard = mk({ pos: "PG", bpg: 0.2, spg: 2.0, htIn: 74, rpg: 3.5, defReb: 2, mpg: 33 });

  it("favors a shot-blocking big at the rim", () => {
    const b = defensiveProfile(big);
    expect(b.subs.rimProtection).toBeGreaterThan(b.subs.perimeter);
    expect(b.subs.rimProtection).toBeGreaterThan(defensiveProfile(guard).subs.rimProtection);
  });

  it("favors a ball-hawking guard on the perimeter", () => {
    const g = defensiveProfile(guard);
    expect(g.subs.perimeter).toBeGreaterThan(g.subs.rimProtection);
    expect(g.subs.perimeter).toBeGreaterThan(defensiveProfile(big).subs.perimeter);
  });

  it("returns radar-ready values aligned to five axes within 0-100", () => {
    for (const p of [big, guard]) {
      const prof = defensiveProfile(p);
      expect(prof.axes).toHaveLength(5);
      expect(prof.values).toHaveLength(5);
      for (const v of prof.values) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(prof.matchupNote.length).toBeGreaterThan(0);
    }
  });
});
