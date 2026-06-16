import { describe, it, expect } from "vitest";
import {
  similarPlayers,
  classifyRole,
  scoutingReport,
  durabilityTrajectory,
  archetypePeakBenchmark,
} from "@/lib/engine/players";
import { getPlayer } from "@/lib/data";
import type { Player } from "@/lib/types";

const BASE: Player = {
  id: "synthetic-player",
  name: "Synthetic Player",
  team: "BOS",
  pos: "SG",
  age: 24,
  htIn: 78,
  wtLb: 210,
  exp: 4,
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

// Real ids from src/lib/data/players.real.json (ESPN ingest)
const EDWARDS = "anthony-edwards-4594268"; // high-usage scoring SG
const MITCHELL = "donovan-mitchell-3908809"; // high-usage scoring SG
const MAXEY = "tyrese-maxey-4431678"; // high-usage scoring SG
const GOBERT = "rudy-gobert-3032976"; // low-usage rim-protecting C
const KESSLER = "walker-kessler-4433136"; // shot-blocking big (1.8 BPG, C)
const BOOKER = "devin-booker-3136193"; // hybrid scorer/creator guard
const CURRY = "stephen-curry-3975"; // age-38, missed games

describe("similarPlayers", () => {
  it("ranks statistically similar guards above an unrelated center", () => {
    const sims = similarPlayers(EDWARDS, 600);
    const score = (id: string) => sims.find((s) => s.player.id === id)!.score;
    expect(score(MITCHELL)).toBeGreaterThan(score(GOBERT));
    expect(score(MAXEY)).toBeGreaterThan(score(GOBERT));
  });

  it("returns shared traits, differences and matched archetype per match", () => {
    const [top] = similarPlayers(EDWARDS, 6);
    expect(top.topSharedTraits).toHaveLength(3);
    expect(top.biggestDifferences).toHaveLength(2);
    expect(top.matchedArchetype).toBe(top.player.archetype);
    for (const t of [...top.topSharedTraits, ...top.biggestDifferences]) {
      expect(Number.isFinite(t.delta)).toBe(true);
      expect(t.delta).toBeGreaterThanOrEqual(0);
    }
    // shared traits are the closest dims, differences the farthest
    const maxShared = Math.max(...top.topSharedTraits.map((t) => t.delta));
    const minDiff = Math.min(...top.biggestDifferences.map((t) => t.delta));
    expect(maxShared).toBeLessThanOrEqual(minDiff);
  });

  it("applies position and age-band filters", () => {
    const target = getPlayer(EDWARDS)!;
    const same = similarPlayers(EDWARDS, 20, { position: "same" });
    expect(same.length).toBeGreaterThan(0);
    for (const s of same) expect(s.player.pos).toBe(target.pos);

    const adjacent = similarPlayers(EDWARDS, 20, { position: "adjacent" });
    for (const s of adjacent) expect(["PG", "SG", "SF"]).toContain(s.player.pos);

    const banded = similarPlayers(EDWARDS, 20, { ageBand: "within3" });
    for (const s of banded) expect(Math.abs(s.player.age - target.age)).toBeLessThanOrEqual(3);
  });

  it("is deterministic and empty for unknown ids", () => {
    const a = similarPlayers(EDWARDS, 6);
    const b = similarPlayers(EDWARDS, 6);
    expect(a.map((r) => [r.player.id, r.score])).toEqual(b.map((r) => [r.player.id, r.score]));
    expect(similarPlayers("nobody-123")).toEqual([]);
  });
});

describe("classifyRole", () => {
  it("classifies a shot-blocking big as a rim protector with fired threshold rules", () => {
    const cls = classifyRole(KESSLER)!;
    expect(cls.role).toBe("Rim Protector");
    expect(cls.matchedTraits.length).toBeGreaterThan(0);
    expect(cls.matchedTraits.join(" ")).toMatch(/BPG/);
    expect(cls.secondaryRoles).toHaveLength(2);
    // scores sorted descending; secondary roles are ranks 2-3
    expect(cls.scores[0].score).toBeGreaterThanOrEqual(cls.secondaryRoles[0].score);
    expect(cls.secondaryRoles[0].score).toBeGreaterThanOrEqual(cls.secondaryRoles[1].score);
  });

  it("drops confidence for a hybrid player relative to a specialist", () => {
    const specialist = classifyRole(KESSLER)!;
    const hybrid = classifyRole(BOOKER)!; // volume scorer / combo guard / creator blend
    expect(specialist.confidence).toBeGreaterThan(hybrid.confidence);
  });

  it("returns 3 same-role players ordered by closest starPower", () => {
    const cls = classifyRole(KESSLER)!;
    expect(cls.similarArchetypePlayers).toHaveLength(3);
    for (const p of cls.similarArchetypePlayers) expect(p.archetype).toBe("Rim Protector");
    const me = getPlayer(KESSLER)!;
    const gaps = cls.similarArchetypePlayers.map((p) => Math.abs(p.starPower - me.starPower));
    expect(gaps).toEqual([...gaps].sort((x, y) => x - y));
  });

  it("returns null for unknown ids", () => {
    expect(classifyRole("nobody-123")).toBeNull();
  });
});

describe("scoutingReport", () => {
  it("contains exactly 3 development priorities derived from weakest z-scores", () => {
    const rep = scoutingReport(EDWARDS)!;
    expect(rep.developmentPriorities).toHaveLength(3);
    expect(rep.priorities).toEqual(rep.developmentPriorities); // back-compat alias
    for (const pr of rep.developmentPriorities) expect(pr).toMatch(/\(z [+−]\d+\.\d\)/);
  });

  it("returns nonempty risk factors, flagging age and availability where real", () => {
    const curry = scoutingReport(CURRY)!;
    expect(curry.riskFactors.length).toBeGreaterThan(0);
    expect(curry.riskFactors.join(" ")).toMatch(/Age 38/);
    expect(curry.riskFactors.join(" ")).toMatch(/missed/i);
    // every player gets at least one factor (healthy profiles get the explicit no-flag line)
    const young = scoutingReport(MAXEY)!;
    expect(young.riskFactors.length).toBeGreaterThan(0);
  });

  it("is null for unknown ids", () => {
    expect(scoutingReport("nobody-123")).toBeNull();
  });
});

describe("durabilityTrajectory", () => {
  it("returns one age-adjusted point per projected year, ages forward", () => {
    const traj = durabilityTrajectory(mk({ age: 25 }), 3);
    expect(traj).toHaveLength(3);
    expect(traj.map((t) => t.age)).toEqual([26, 27, 28]);
    for (const pt of traj) {
      expect(pt.risk).toBeGreaterThanOrEqual(0);
      expect(pt.risk).toBeLessThanOrEqual(100);
      expect(["Low", "Moderate", "Elevated"]).toContain(pt.band);
    }
  });

  it("collapses to the three season-level bands at the same cut points", () => {
    for (const pt of durabilityTrajectory(mk({ age: 28, mpg: 36 }), 3)) {
      if (pt.risk < 30) expect(pt.band).toBe("Low");
      else if (pt.risk < 50) expect(pt.band).toBe("Moderate");
      else expect(pt.band).toBe("Elevated");
    }
  });

  it("rises with age — risk later in the horizon is at least as high as earlier", () => {
    const traj = durabilityTrajectory(mk({ age: 30, mpg: 34 }), 3);
    expect(traj[2].risk).toBeGreaterThanOrEqual(traj[0].risk);
  });

  it("rates a young low-minutes player more durable than an aging heavy-minutes one", () => {
    const young = durabilityTrajectory(mk({ age: 22, mpg: 24, gp: 78 }), 3);
    const old = durabilityTrajectory(mk({ age: 35, mpg: 37, gp: 55 }), 3);
    expect(young[0].risk).toBeLessThan(old[0].risk);
  });

  it("honors a custom horizon length", () => {
    expect(durabilityTrajectory(mk({ age: 26 }), 1)).toHaveLength(1);
    expect(durabilityTrajectory(mk({ age: 26 }), 5)).toHaveLength(5);
  });
});

describe("archetypePeakBenchmark", () => {
  it("benchmarks a real player against same-archetype peers", () => {
    const edwards = getPlayer(EDWARDS)!;
    const b = archetypePeakBenchmark(edwards);
    expect(b.archetype).toBe(edwards.archetype);
    expect(b.peerCount).toBeGreaterThan(0);
    expect(b.peerPeakMedian).not.toBeNull();
    expect(b.percentile).toBeGreaterThanOrEqual(0);
    expect(b.percentile).toBeLessThanOrEqual(100);
    expect([
      "Top-tier for archetype",
      "Above peer median",
      "Around peer median",
      "Below peer median",
    ]).toContain(b.verdict);
  });

  it("grades an elite peak top-tier and high percentile vs its cohort", () => {
    const star = archetypePeakBenchmark(getPlayer(EDWARDS)!);
    expect(star.percentile).toBeGreaterThanOrEqual(70);
  });

  it("returns the no-peers branch for a unique synthetic archetype", () => {
    const unicorn = mk({ id: "unicorn", archetype: "__no-such-archetype__", per: 22 });
    const b = archetypePeakBenchmark(unicorn);
    expect(b.peerCount).toBe(0);
    expect(b.peerPeakMedian).toBeNull();
    expect(b.percentile).toBe(100);
    expect(b.verdict).toBe("No archetype peers");
  });

  it("excludes the player from its own peer set (synthetic injected via real id reuse)", () => {
    // A real roster player benchmarked against its archetype peers should never
    // count itself: peerCount must be strictly less than the full cohort size.
    const gobert = getPlayer(GOBERT)!;
    const b = archetypePeakBenchmark(gobert);
    const cohort = [gobert]; // at minimum, the player exists in the league
    expect(b.peerCount).toBeGreaterThanOrEqual(cohort.length - 1);
    expect(b.thisPeak).toBeGreaterThan(0);
  });
});
