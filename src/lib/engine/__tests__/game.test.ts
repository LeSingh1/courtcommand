import { describe, it, expect } from "vitest";
import {
  shotQuality,
  validateShotInput,
  biggestSwings,
  gameRecap,
  type ShotInput,
} from "@/lib/engine/game";

// ---------------- shotQuality ----------------

const EASY: ShotInput = {
  shotType: "catch3",
  defenderDist: 8,
  shotClock: 16,
  touchTime: 1,
  dribbles: 0,
  isCatchAndShoot: true,
  period: 1,
};
const AVERAGE: ShotInput = {
  shotType: "catch3",
  defenderDist: 3.5,
  shotClock: 10,
  touchTime: 2,
  dribbles: 1,
  isCatchAndShoot: false,
  period: 2,
};
const DIFFICULT: ShotInput = {
  shotType: "stepback3",
  defenderDist: 1,
  shotClock: 3,
  touchTime: 6,
  dribbles: 7,
  isCatchAndShoot: false,
  period: 4,
};

describe("shotQuality", () => {
  it("orders qSQ easy > average > difficult", () => {
    const easy = shotQuality(EASY);
    const avg = shotQuality(AVERAGE);
    const hard = shotQuality(DIFFICULT);
    expect(easy.qSQ).toBeGreaterThan(avg.qSQ);
    expect(avg.qSQ).toBeGreaterThan(hard.qSQ);
  });

  it("orders difficulty_score inversely: difficult > average > easy, all within 0-100", () => {
    const easy = shotQuality(EASY);
    const avg = shotQuality(AVERAGE);
    const hard = shotQuality(DIFFICULT);
    expect(hard.difficulty_score).toBeGreaterThan(avg.difficulty_score);
    expect(avg.difficulty_score).toBeGreaterThan(easy.difficulty_score);
    for (const r of [easy, avg, hard]) {
      expect(r.difficulty_score).toBeGreaterThanOrEqual(0);
      expect(r.difficulty_score).toBeLessThanOrEqual(100);
    }
  });

  it("flags risk factors on the hard shot and none on the open catch-and-shoot", () => {
    const hard = shotQuality(DIFFICULT);
    expect(hard.risk_factors).toContain("late clock");
    expect(hard.risk_factors).toContain("tight closeout");
    expect(hard.risk_factors).toContain("off 5+ dribbles");
    expect(hard.risk_factors).toContain("step-back penalty");
    expect(hard.risk_factors).toContain("long touch time");

    const easy = shotQuality(EASY);
    expect(easy.risk_factors).toEqual([]);
  });

  it("keeps the natural-language rating consistent with qSQ", () => {
    const easy = shotQuality(EASY);
    const hard = shotQuality(DIFFICULT);
    expect(typeof easy.rating).toBe("string");
    expect(easy.rating.length).toBeGreaterThan(0);
    expect(easy.rating).not.toBe(hard.rating);
  });

  it("rejects out-of-range inputs with clear error strings", () => {
    expect(() => shotQuality({ ...EASY, defenderDist: -1 })).toThrow(/defenderDist out of range/);
    expect(() => shotQuality({ ...EASY, shotClock: 30 })).toThrow(/shotClock out of range/);
    expect(() => shotQuality({ ...EASY, dribbles: -2 })).toThrow(/dribbles out of range/);
    expect(() => shotQuality({ ...EASY, touchTime: 99 })).toThrow(/touchTime out of range/);
    expect(() => shotQuality({ ...EASY, defenderDist: Number.NaN })).toThrow(/finite number/);
    expect(() => shotQuality({ ...EASY, shotType: "dunk" as ShotInput["shotType"] })).toThrow(
      /Unknown shotType/,
    );
  });

  it("clamps valid-but-extreme inputs into the model range instead of rejecting", () => {
    const v = validateShotInput({ ...EASY, defenderDist: 39, dribbles: 35 });
    expect(v.defenderDist).toBe(20);
    expect(v.dribbles).toBe(20);
    const r = shotQuality({ ...EASY, defenderDist: 39 });
    expect(r.qSQ).toBeGreaterThanOrEqual(0);
    expect(r.qSQ).toBeLessThanOrEqual(100);
  });
});

// ---------------- biggestSwings ----------------

describe("biggestSwings", () => {
  // Synthetic comeback: AAA favored, collapses below 50, then storms back.
  const comeback = {
    teams: ["AAA", "BBB"],
    home: [50, 60, 65, 40, 20, 35, 55, 70, 90],
  };

  it("returns the 3 largest single-step swings with index + delta + label", () => {
    const r = biggestSwings(comeback);
    expect(r.swings).toHaveLength(3);
    expect(r.swings[0]).toMatchObject({ index: 3, delta: -25 });
    expect(r.swings[1]).toMatchObject({ index: 4, delta: -20 });
    // Tie on |20| between index 6 and index 8 — earliest wins.
    expect(r.swings[2]).toMatchObject({ index: 6, delta: 20 });
    expect(r.swings[0].label).toContain("BBB");
    expect(r.swings[2].label).toContain("AAA");
  });

  it("finds the turning point at the last lead-probability flip", () => {
    const r = biggestSwings(comeback);
    expect(r.turningPoint).not.toBeNull();
    expect(r.turningPoint!.index).toBe(6); // 35 -> 55: AAA retake the lead for good
    expect(r.turningPoint!.team).toBe("AAA");
    expect(r.turningPoint!.wp).toBe(55);
  });

  it("returns no turning point for a wire-to-wire curve", () => {
    const r = biggestSwings({ teams: ["AAA", "BBB"], home: [60, 70, 65, 80, 90] });
    expect(r.turningPoint).toBeNull();
    expect(r.swings.length).toBeGreaterThan(0);
  });

  it("handles flat and too-short curves without crashing", () => {
    expect(biggestSwings({ teams: ["AAA", "BBB"], home: [55, 55, 55] })).toEqual({
      swings: [],
      turningPoint: null,
    });
    expect(biggestSwings({ teams: ["AAA", "BBB"], home: [50] })).toEqual({
      swings: [],
      turningPoint: null,
    });
  });
});

// ---------------- gameRecap ----------------

const STARS_HOME = [
  { name: "Jayson Tatum", pts: 31, reb: 9, ast: 5 },
  { name: "Jaylen Brown", pts: 24, reb: 6, ast: 4 },
];
const STARS_AWAY = [
  { name: "LeBron James", pts: 28, reb: 8, ast: 9 },
  { name: "Luka Doncic", pts: 27, reb: 7, ast: 8 },
];

describe("gameRecap", () => {
  it("blowout: 3 distinct headlines, 4-6 verifiable key facts, correct top performer", () => {
    const r = gameRecap({
      homeTeam: "BOS",
      awayTeam: "LAL",
      homeScore: 130,
      awayScore: 100,
      homeStars: STARS_HOME,
      awayStars: STARS_AWAY,
    });
    expect(r.headline_options).toHaveLength(3);
    expect(new Set(r.headline_options.map((o) => o.text)).size).toBe(3);
    expect(r.headline_options.map((o) => o.style)).toEqual(["straight", "dramatic", "stat-led"]);
    expect(r.headline_options[1].text).toContain("30-point");
    expect(r.key_facts.length).toBeGreaterThanOrEqual(4);
    expect(r.key_facts.length).toBeLessThanOrEqual(6);
    expect(r.key_facts.join(" ")).toContain("Margin of victory: 30 points");
    expect(r.key_facts.join(" ")).toContain("Combined scoring: 230 points");
    expect(r.topPerformer?.name).toBe("Jayson Tatum");
  });

  it("1-point game: nail-biter copy, single-possession fact, dramatic survive headline", () => {
    const r = gameRecap({
      homeTeam: "BOS",
      awayTeam: "LAL",
      homeScore: 110,
      awayScore: 111,
      homeStars: STARS_HOME,
      awayStars: STARS_AWAY,
    });
    expect(r.body[0]).toContain("nail-biter");
    expect(r.key_facts.join(" ")).toContain("Margin of victory: 1 point (single possession)");
    expect(r.headline_options[1].text).toContain("survive");
    expect(r.key_facts.join(" ")).toContain("on the road");
    // Highest scorer across BOTH teams, independent of who won.
    expect(r.topPerformer?.name).toBe("Jayson Tatum");
    // Most assists fact comes from the away side here.
    expect(r.key_facts.join(" ")).toContain("LeBron James with 9");
  });

  it("empty star lines: no crash, null top performer, sensible copy, no 'undefined' anywhere", () => {
    const r = gameRecap({
      homeTeam: "BOS",
      awayTeam: "LAL",
      homeScore: 118,
      awayScore: 112,
      homeStars: [],
      awayStars: [],
    });
    expect(r.topPerformer).toBeNull();
    expect(r.headline_options).toHaveLength(3);
    expect(new Set(r.headline_options.map((o) => o.text)).size).toBe(3);
    expect(r.key_facts.length).toBeGreaterThanOrEqual(4);
    const everything = [r.headline, ...r.headline_options.map((o) => o.text), ...r.body, ...r.key_facts].join(" ");
    expect(everything).not.toContain("undefined");
    expect(r.body.join(" ")).toContain("collective");
  });

  it("unknown team abbreviations fall back to the raw input without crashing", () => {
    const r = gameRecap({
      homeTeam: "XXX",
      awayTeam: "YYY",
      homeScore: 100,
      awayScore: 90,
      homeStars: [],
      awayStars: [],
    });
    expect(r.headline).toContain("XXX");
    expect(r.headline_options[0].text).toContain("YYY");
  });
});
