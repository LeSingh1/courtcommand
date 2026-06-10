import { describe, it, expect } from "vitest";
import { similarPlayers, classifyRole, scoutingReport } from "@/lib/engine/players";
import { getPlayer } from "@/lib/data";

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
