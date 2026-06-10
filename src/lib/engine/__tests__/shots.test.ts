import { describe, it, expect } from "vitest";
import {
  clutchLeaders,
  isClutchShot,
  gameMomentum,
  highlightReel,
  filterReelByTag,
  realShotChart,
  playerForm,
  type RealShot,
} from "@/lib/data/shots";
import { ftrZScores, ftrSampleSizeWarning, type FtRate } from "@/lib/data/ftrate";

let seq = 0;
function shot(over: Partial<RealShot> = {}): RealShot {
  seq++;
  return {
    id: `s${seq}`,
    espnId: 1,
    player: "Player One",
    team: "AAA",
    gameId: "g1",
    game: "AAA vs BBB",
    date: "2026-05-01",
    period: 1,
    clock: "10:00",
    dist: 5,
    value: 2,
    made: true,
    assisted: false,
    shotType: "layup",
    typeText: "Layup",
    text: "Player One makes layup",
    x: 250,
    y: 80,
    ...over,
  };
}

function repeat(n: number, over: Partial<RealShot>): RealShot[] {
  return Array.from({ length: n }, () => shot(over));
}

describe("clutch definition windows", () => {
  // p1: Q4 4:30 (inside last 5:00 only), p2: Q4 1:30 (inside both windows),
  // p3: OT at 4:00 (inside the 5:00 window and OT-only, outside last 2:00).
  const fixture: RealShot[] = [
    ...repeat(3, { espnId: 1, player: "P1", period: 4, clock: "4:30" }),
    ...repeat(12, { espnId: 2, player: "P2", period: 4, clock: "1:30" }),
    ...repeat(3, { espnId: 3, player: "P3", period: 5, clock: "4:00" }),
    ...repeat(5, { espnId: 4, player: "P4", period: 2, clock: "1:00" }), // never clutch
  ];

  const ids = (minAtt: number, opts: Parameters<typeof clutchLeaders>[2]) =>
    clutchLeaders(fixture, minAtt, opts)
      .map((l) => l.espnId)
      .sort();

  it("changes the leader set as the window changes", () => {
    expect(ids(1, { lastMinutes: 5 })).toEqual([1, 2, 3]);
    expect(ids(1, { lastMinutes: 2 })).toEqual([2]);
    expect(ids(1, { otOnly: true })).toEqual([3]);
  });

  it("default options match the original definition (last 5:00 of Q4 + all OT)", () => {
    const q4Late = shot({ period: 4, clock: "4:59" });
    const q4Early = shot({ period: 4, clock: "5:01" });
    const ot = shot({ period: 5, clock: "5:00" });
    expect(isClutchShot(q4Late)).toBe(true);
    expect(isClutchShot(q4Early)).toBe(false);
    expect(isClutchShot(ot)).toBe(true);
    expect(isClutchShot(ot, { includeOT: false })).toBe(false);
  });

  it("flags small samples below 10 attempts", () => {
    const board = clutchLeaders(fixture, 1, { lastMinutes: 5 });
    const p1 = board.find((l) => l.espnId === 1)!;
    const p2 = board.find((l) => l.espnId === 2)!;
    expect(p1.att).toBe(3);
    expect(p1.smallSample).toBe(true);
    expect(p2.att).toBe(12);
    expect(p2.smallSample).toBe(false);
  });
});

describe("momentum post-run response", () => {
  // AAA rips off an 8-0 run (four 2pt makes); BBB's only attempt before the
  // run ends is a miss (baseline 0%), then BBB goes 3/5 on its next attempts.
  const game: RealShot[] = [
    shot({ team: "AAA", period: 1, clock: "11:00", made: true }),
    shot({ team: "BBB", player: "B", espnId: 9, period: 1, clock: "10:45", made: false }),
    shot({ team: "AAA", period: 1, clock: "10:30", made: true }),
    shot({ team: "AAA", period: 1, clock: "10:00", made: true }),
    shot({ team: "AAA", period: 1, clock: "9:30", made: true }),
    shot({ team: "BBB", player: "B", espnId: 9, period: 1, clock: "9:00", made: true }),
    shot({ team: "BBB", player: "B", espnId: 9, period: 1, clock: "8:40", made: false }),
    shot({ team: "BBB", player: "B", espnId: 9, period: 1, clock: "8:20", made: true }),
    shot({ team: "BBB", player: "B", espnId: 9, period: 1, clock: "8:00", made: false }),
    shot({ team: "BBB", player: "B", espnId: 9, period: 1, clock: "7:40", made: true }),
  ];

  it("computes the conceding team's next-5 response and improvement", () => {
    const mom = gameMomentum(game, "g1");
    expect(mom.keyShiftEvents).toHaveLength(1); // only the 8-0 AAA run qualifies
    const e = mom.keyShiftEvents[0];
    expect(e.run.team).toBe("AAA");
    expect(e.run.pts).toBe(8);
    expect(e.response).not.toBeNull();
    expect(e.response!.team).toBe("BBB");
    expect(e.response!.att).toBe(5);
    expect(e.response!.made).toBe(3);
    expect(e.response!.baselinePct).toBe(0); // 0/1 before the run ended
    expect(e.response!.improved).toBe(true);
    expect(e.label).toContain("3/5");
    expect(e.label).toContain("8-0");
  });
});

describe("highlight reel", () => {
  const fixture: RealShot[] = [
    shot({ text: "X throws down the dunk", period: 4, clock: "2:00", made: true }), // dunk + clutch
    shot({ text: "Y makes 30-foot three", value: 3, dist: 30, period: 1, made: true }), // deep three
    shot({ text: "Z stepback jumper", period: 1, made: true, dist: 18 }), // below threshold
    shot({ text: "W misses dunk", made: false }), // misses never score
  ];

  it("orders ranks 1..n by descending score", () => {
    const reel = highlightReel(fixture, 10);
    expect(reel.length).toBe(2);
    expect(reel.map((h) => h.rank)).toEqual([1, 2]);
    for (let i = 1; i < reel.length; i++) expect(reel[i - 1].score).toBeGreaterThanOrEqual(reel[i].score);
  });

  it("builds clip windows from the game clock (±4s, period-clamped)", () => {
    const reel = highlightReel(fixture, 10);
    const dunk = reel.find((h) => h.tags.includes("Dunk"))!;
    expect(dunk.clipStart).toBe("Q4 2:04");
    expect(dunk.clipEnd).toBe("Q4 1:56");
  });

  it("filters by tag while preserving overall ranks", () => {
    const reel = highlightReel(fixture, 10);
    const deep = filterReelByTag(reel, "Deep three");
    expect(deep.length).toBe(1);
    expect(deep[0].tags).toContain("Deep three");
    expect(deep[0].rank).toBe(reel.findIndex((h) => h.tags.includes("Deep three")) + 1);
    expect(filterReelByTag(reel, null)).toHaveLength(reel.length);
  });
});

describe("real shot chart quarter filter + diet", () => {
  const fixture: RealShot[] = [
    ...repeat(6, { espnId: 7, period: 1, dist: 3, value: 2, x: 250, y: 80 }), // rim, Q1
    ...repeat(4, { espnId: 7, period: 4, dist: 25, value: 3, x: 250, y: 320 }), // threes, Q4
    ...repeat(10, { espnId: 8, period: 1, dist: 15, value: 2, x: 130, y: 150 }), // pool midrange
  ];

  it("restricts to the requested quarter", () => {
    const all = realShotChart(fixture, 7)!;
    const q4 = realShotChart(fixture, 7, { period: 4 })!;
    expect(all.total).toBe(10);
    expect(q4.total).toBe(4);
    expect(realShotChart(fixture, 7, { period: 3 })).toBeNull(); // no Q3 shots
  });

  it("summarizes the shot diet and sums to 1", () => {
    const q4 = realShotChart(fixture, 7, { period: 4 })!;
    expect(q4.diet.three).toBe(1);
    expect(q4.diet.rim).toBe(0);
    const all = realShotChart(fixture, 7)!;
    expect(all.diet.rim + all.diet.mid + all.diet.three).toBeCloseTo(1, 10);
    expect(all.diet.rim).toBeCloseTo(0.6, 10);
    expect(all.diet.note.length).toBeGreaterThan(0);
  });
});

describe("player form shifts", () => {
  // Four games, FG points 4 / 20 / 6 / 18 — all makes so eFG is constant and
  // the momentum score is a pure z-score of points.
  const games: { id: string; date: string; opp: string; makes: number }[] = [
    { id: "f1", date: "2026-05-01", opp: "DDD", makes: 2 },
    { id: "f2", date: "2026-05-02", opp: "EEE", makes: 10 },
    { id: "f3", date: "2026-05-03", opp: "FFF", makes: 3 },
    { id: "f4", date: "2026-05-04", opp: "GGG", makes: 9 },
  ];
  const fixture: RealShot[] = games.flatMap((g) =>
    repeat(g.makes, {
      espnId: 11,
      player: "Form Guy",
      team: "CCC",
      gameId: g.id,
      game: `CCC vs ${g.opp}`,
      date: g.date,
      made: true,
      value: 2,
    }),
  );

  it("picks the right game pairs for biggest shifts, with opponent labels", () => {
    const form = playerForm(fixture, 11)!;
    expect(form).not.toBeNull();
    const bp = form.biggestPositiveShift!;
    const bn = form.biggestNegativeShift!;
    expect(bp.fromGame.opp).toBe("DDD"); // 4 -> 20 pts is the biggest jump
    expect(bp.toGame.opp).toBe("EEE");
    expect(bp.delta).toBeGreaterThan(0);
    expect(bn.fromGame.opp).toBe("EEE"); // 20 -> 6 pts is the biggest drop
    expect(bn.toGame.opp).toBe("FFF");
    expect(bn.delta).toBeLessThan(0);
    expect(bp.delta).toBe(bp.toGame.score - bp.fromGame.score);
  });
});

describe("FTr z-scores and sample warnings", () => {
  const pool: FtRate[] = [
    { espnId: 1, name: "A", team: "T1", fta: 5, fga: 10, ftr: 0.2, ftp: 0.8 },
    { espnId: 2, name: "B", team: "T2", fta: 5, fga: 10, ftr: 0.3, ftp: 0.8 },
    { espnId: 3, name: "C", team: "T3", fta: 5, fga: 10, ftr: 0.4, ftp: 0.8 },
    { espnId: 4, name: "D", team: "T4", fta: 5, fga: 2, ftr: 0.5, ftp: 0.8 },
  ];

  it("standardizes correctly (mean 0, std 1, exact z for a known value)", () => {
    const rated = ftrZScores(pool);
    const zs = rated.map((r) => r.z);
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    const std = Math.sqrt(zs.reduce((a, b) => a + (b - mean) ** 2, 0) / zs.length);
    expect(mean).toBeCloseTo(0, 10);
    expect(std).toBeCloseTo(1, 10);
    // pool mean 0.35, population std sqrt(0.0125): z(0.5) = 0.15/0.1118 ≈ 1.3416
    expect(rated.find((r) => r.espnId === 4)!.z).toBeCloseTo(1.3416, 3);
  });

  it("flags thin samples", () => {
    expect(ftrSampleSizeWarning(150)).toBe(true); // season totals
    expect(ftrSampleSizeWarning(250)).toBe(false);
    expect(ftrSampleSizeWarning(2.0, true)).toBe(true); // 164 FGA at an 82-game pace
    expect(ftrSampleSizeWarning(3.0, true)).toBe(false); // 246 FGA pace
    const rated = ftrZScores(pool);
    expect(rated.find((r) => r.espnId === 4)!.smallSample).toBe(true); // 2 FGA/g
    expect(rated.find((r) => r.espnId === 1)!.smallSample).toBe(false); // 10 FGA/g
  });
});
