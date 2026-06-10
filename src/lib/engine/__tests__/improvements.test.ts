import { describe, it, expect } from "vitest";
import { ebShrink, wilsonCI, shrinkToZero } from "@/lib/engine/stats";
import { gameWpSeries, wpCalibration, secondsLeftAt, type PbpGame } from "@/lib/data/pbp";
import { shotMakingBoard } from "@/lib/engine/shotmaking";
import type { RealShot } from "@/lib/data/shots";

describe("empirical-Bayes shrinkage", () => {
  it("returns the prior at n=0 and approaches the observation as n grows", () => {
    expect(ebShrink(0.9, 0, 0.5, 15)).toBe(0.5);
    expect(ebShrink(0.9, 10000, 0.5, 15)).toBeCloseTo(0.9, 2);
  });
  it("matches the closed form (n·obs + k·prior)/(n+k)", () => {
    expect(ebShrink(0.6, 10, 0.45, 15)).toBeCloseTo((10 * 0.6 + 15 * 0.45) / 25, 10);
  });
  it("pulls a hot small sample most of the way back to the prior", () => {
    // 4-for-5 in the clutch, career 47% shooter
    const adj = ebShrink(0.8, 5, 0.47, 15);
    expect(adj).toBeGreaterThan(0.47);
    expect(adj).toBeLessThan(0.56); // far from the raw 80%
  });
});

describe("Wilson interval", () => {
  it("stays inside [0,1] even at extreme small samples", () => {
    const [lo, hi] = wilsonCI(3, 3);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeLessThanOrEqual(1);
  });
  it("narrows as n grows", () => {
    const small = wilsonCI(10, 20);
    const large = wilsonCI(100, 200);
    expect(small[1] - small[0]).toBeGreaterThan(large[1] - large[0]);
  });
});

describe("shrinkToZero", () => {
  it("is 0 at n=0 and scales by n/(n+k)", () => {
    expect(shrinkToZero(8, 0, 50)).toBe(0);
    expect(shrinkToZero(8, 50, 50)).toBeCloseTo(4, 10);
    expect(shrinkToZero(-6, 150, 50)).toBeCloseTo(-4.5, 10);
  });
});

// ---- event-driven WP on a synthetic two-quarter game -----------------------
function fixtureGame(): PbpGame {
  // BOS (home) trails early, pulls away late — includes FTs and a turnover.
  const ev = (
    p: number,
    c: number,
    h: number,
    a: number,
    t: 1 | 0 | -1,
    k: "s" | "f" | "o" | "e",
    v = 0,
  ) => ({ p, c, h, a, t, k, v });
  return {
    gameId: "fx1",
    home: "BOS",
    away: "NYK",
    events: [
      ev(1, 700, 0, 2, 0, "s", 2),
      ev(1, 600, 0, 4, 0, "s", 2),
      ev(1, 500, 2, 4, 1, "s", 2),
      ev(2, 400, 10, 12, 0, "s", 2),
      ev(3, 300, 30, 28, 1, "s", 3),
      ev(4, 400, 60, 50, 1, "s", 2),
      ev(4, 200, 62, 50, 1, "f", 1), // free throws move the curve now
      ev(4, 100, 62, 50, 0, "o"), // away turnover
      ev(4, 10, 64, 50, 1, "s", 2),
    ],
  };
}

describe("event-driven win probability", () => {
  it("builds a point per state change, free throws and turnovers included", () => {
    const s = gameWpSeries(fixtureGame());
    expect(s.points.length).toBe(9);
    expect(s.points.some((p) => p.kind === "f")).toBe(true);
    expect(s.points.some((p) => p.kind === "o")).toBe(true);
  });
  it("ends near certainty for a double-digit home win and marks homeWon", () => {
    const s = gameWpSeries(fixtureGame());
    expect(s.homeWon).toBe(true);
    expect(s.finalMargin).toBe(14);
    expect(s.points.at(-1)!.wp).toBeGreaterThan(95);
  });
  it("accumulates excitement and at most three headline swings", () => {
    const s = gameWpSeries(fixtureGame());
    expect(s.excitement).toBeGreaterThan(0);
    expect(s.swings.length).toBeLessThanOrEqual(3);
  });
  it("computes seconds left correctly across quarters and OT", () => {
    expect(secondsLeftAt(1, 720)).toBe(2880);
    expect(secondsLeftAt(4, 300)).toBe(300);
    expect(secondsLeftAt(5, 120)).toBe(120);
  });
  it("scores calibration buckets with sane Brier values", () => {
    const cal = wpCalibration([fixtureGame()]);
    const total = cal.reduce((a, b) => a + b.n, 0);
    expect(total).toBe(9);
    for (const b of cal) {
      expect(b.brier).toBeGreaterThanOrEqual(0);
      expect(b.brier).toBeLessThanOrEqual(1);
    }
    // late-game predictions on a decided game should be sharper than Q1
    const q1 = cal.find((b) => b.label === "Q1")!;
    const late = cal.find((b) => b.label === "Last 5:00")!;
    expect(late.brier).toBeLessThan(q1.brier);
  });
});

// ---- shot-making over expected ---------------------------------------------
function rimShot(espnId: number, player: string, i: number, made: boolean): RealShot {
  return {
    id: `${espnId}-${i}`,
    espnId,
    player,
    team: "BOS",
    gameId: "g1",
    game: "BOS vs NYK",
    date: "2026-05-01",
    period: 1,
    clock: "10:00",
    dist: 2,
    value: 2,
    made,
    assisted: false,
    shotType: "rim",
    typeText: "Layup",
    text: "",
    x: 250,
    y: 70,
  };
}

describe("shot-making over expected", () => {
  it("credits a player who beats the model's expectation and shrinks the delta", () => {
    const shots: RealShot[] = [];
    for (let i = 0; i < 60; i++) shots.push(rimShot(1, "Hot Hand", i, i < 50)); // ~83% actual at the rim
    for (let i = 0; i < 10; i++) shots.push(rimShot(2, "Tiny Sample", i, true)); // under minAtt
    const board = shotMakingBoard(shots, 40, 50);
    expect(board.length).toBe(1);
    const row = board[0];
    expect(row.player).toBe("Hot Hand");
    expect(row.rawDelta).toBeGreaterThan(0);
    expect(Math.abs(row.adjDelta)).toBeLessThan(Math.abs(row.rawDelta));
    expect(Math.abs(row.adjDelta - row.rawDelta * (60 / 110))).toBeLessThan(0.11);
  });
});
