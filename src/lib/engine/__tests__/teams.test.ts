import { describe, expect, it } from "vitest";
import type { Player } from "@/lib/types";
import { PLAYERS, SECOND_APRON } from "@/lib/data";
import {
  evaluateTrade,
  scoreLineup,
  bestLineup,
  teamChemistry,
  best_team_matches,
  pickAndRoll,
  playTypeMix,
  teamPlayTypeMix,
  MAX_OUTGOING,
} from "@/lib/engine/teams";

let seq = 0;
function makePlayer(over: Partial<Player> = {}): Player {
  seq += 1;
  return {
    id: `test-${seq}`,
    name: `Test Player ${seq}`,
    team: "BOS",
    pos: "PG",
    age: 25,
    htIn: 77,
    wtLb: 210,
    exp: 4,
    salary: 10,
    gp: 70,
    mpg: 30,
    ppg: 15,
    rpg: 5,
    apg: 4,
    spg: 1,
    bpg: 0.5,
    topg: 2,
    fgp: 0.47,
    tpp: 0.35,
    ftp: 0.8,
    tpa: 5,
    usg: 22,
    tsp: 0.57,
    per: 16,
    bpm: 1,
    netRtg: 1,
    shotRim: 0.35,
    shotMid: 0.25,
    shotThree: 0.4,
    clutchPpg: 2.3,
    clutchFgp: 0.45,
    clutchUsg: 23,
    defReb: 3,
    defImpact: 50,
    offImpact: 55,
    injuryRisk: 30,
    ortg: 112,
    drtg: 112,
    archetype: "Connector",
    starPower: 50,
    efficiency: 55,
    ...over,
  };
}

describe("evaluateTrade", () => {
  it("rejects an over-cap trade with per-side failure reasons", () => {
    // NYK payroll sits above the 2nd apron in the real data this engine runs on
    const star = makePlayer({ salary: 40, age: 26 });
    const filler = makePlayer({ salary: 5 });
    const res = evaluateTrade([
      { team: "NYK", outgoing: [filler], incoming: [star] },
      { team: "BKN", outgoing: [star], incoming: [filler] },
    ]);
    expect(res.legal).toBe(false);
    expect(res.violations.length).toBeGreaterThan(0);
    const nyk = res.sides.find((s) => s.team.abbr === "NYK")!;
    expect(nyk.team.payroll).toBeGreaterThan(SECOND_APRON);
    expect(nyk.failure_reasons.length).toBeGreaterThan(0);
    expect(nyk.failure_reasons.join(" ")).toMatch(/absorb|2nd apron/);
    // the clean side carries no failure reasons of its own
    const bkn = res.sides.find((s) => s.team.abbr === "BKN")!;
    expect(bkn.failure_reasons).toEqual([]);
  });

  it("passes a legal swap between two under-cap teams", () => {
    const a = makePlayer({ salary: 20, age: 25 });
    const b = makePlayer({ salary: 19, age: 24 });
    const res = evaluateTrade([
      { team: "BKN", outgoing: [a], incoming: [b] },
      { team: "MEM", outgoing: [b], incoming: [a] },
    ]);
    expect(res.legal).toBe(true);
    expect(res.violations).toEqual([]);
    for (const s of res.sides) {
      expect(s.failure_reasons).toEqual([]);
      expect(s.roster_fit_score).toBeGreaterThanOrEqual(0);
      expect(s.roster_fit_score).toBeLessThanOrEqual(100);
    }
  });

  it("rejects more than 4 outgoing players per team with a clear reason", () => {
    const five = Array.from({ length: 5 }, () => makePlayer({ salary: 2 }));
    const back = makePlayer({ salary: 8 });
    const res = evaluateTrade([
      { team: "BKN", outgoing: five, incoming: [back] },
      { team: "MEM", outgoing: [back], incoming: five },
    ]);
    expect(res.legal).toBe(false);
    const bkn = res.sides.find((s) => s.team.abbr === "BKN")!;
    expect(bkn.failure_reasons.join(" ")).toContain(`${MAX_OUTGOING} outgoing`);
  });

  it("grades incoming aging-contract risk deterministically", () => {
    const agingMax = makePlayer({ salary: 50, age: 30, name: "Old Max" });
    const young = makePlayer({ salary: 50, age: 23 });
    const high = evaluateTrade([
      { team: "BKN", outgoing: [young], incoming: [agingMax] },
      { team: "MEM", outgoing: [agingMax], incoming: [young] },
    ]);
    const bkn = high.sides.find((s) => s.team.abbr === "BKN")!;
    expect(bkn.contract_risk.level).toBe("High");
    expect(bkn.contract_risk.exposure).toBeGreaterThan(110);
    expect(bkn.contract_risk.why).toContain("Old Max");
    // youth-only side is Low with zero exposure
    const mem = high.sides.find((s) => s.team.abbr === "MEM")!;
    expect(mem.contract_risk.level).toBe("Low");
    expect(mem.contract_risk.exposure).toBe(0);
  });
});

describe("scoreLineup / bestLineup", () => {
  const positions = ["PG", "SG", "SF", "PF", "C"] as const;
  const defenders = positions.map((pos) =>
    makePlayer({ pos, defImpact: 90, offImpact: 40, shotThree: 0.05, tpp: 0.25, usg: 18, apg: 2, starPower: 45, clutchPpg: 1 }),
  );
  const shooters = positions.map((pos) =>
    makePlayer({ pos, defImpact: 25, offImpact: 75, shotThree: 0.55, tpp: 0.42, usg: 22, apg: 4, starPower: 60, clutchPpg: 3 }),
  );
  const pool = [...defenders, ...shooters];

  it("goal presets reorder the chosen five", () => {
    const def = bestLineup(pool, "best_defense")!;
    const sho = bestLineup(pool, "best_shooting")!;
    const defIds = new Set(def.five.map((p) => p.id));
    const shoIds = new Set(sho.five.map((p) => p.id));
    expect([...defIds].sort()).not.toEqual([...shoIds].sort());
    expect(def.defense).toBeGreaterThan(sho.defense);
    expect(sho.spacing).toBeGreaterThan(def.spacing);
  });

  it("flags role conflicts for stacked usage and positional logjams", () => {
    const five = [
      makePlayer({ pos: "PG", usg: 31 }),
      makePlayer({ pos: "PG", usg: 30 }),
      makePlayer({ pos: "PG", usg: 20 }),
      makePlayer({ pos: "SF", usg: 18 }),
      makePlayer({ pos: "C", usg: 16 }),
    ];
    const s = scoreLineup(five);
    expect(s.role_conflicts.some((c) => c.includes("usage"))).toBe(true);
    expect(s.role_conflicts.some((c) => c.includes("logjam"))).toBe(true);
  });

  it("labels top-2 strengths and bottom-2 weaknesses from the sub-scores", () => {
    const s = scoreLineup(defenders);
    expect(s.strengths).toHaveLength(2);
    expect(s.weaknesses).toHaveLength(2);
    // a 90-defImpact unit must list Defense among strengths
    expect(s.strengths.join(" ")).toContain("Defense");
    expect(s.strengths[0]).toMatch(/^\w+ \(\d+\)$/);
    // strengths and weaknesses never overlap
    for (const w of s.weaknesses) expect(s.strengths).not.toContain(w);
  });

  it("keeps the default goal identical to the legacy weighting", () => {
    const a = scoreLineup(shooters);
    const b = scoreLineup(shooters, "best_overall");
    expect(a.overall).toBe(b.overall);
  });
});

describe("teamChemistry", () => {
  it("fires a usage-collision red flag when joining a high-usage star", () => {
    const star = [...PLAYERS].filter((p) => p.usg >= 28).sort((a, b) => b.usg - a.usg)[0];
    expect(star).toBeDefined();
    const newcomer = makePlayer({ usg: 31, pos: star.pos, team: "ZZZ" });
    const res = teamChemistry(newcomer, star.team);
    expect(res.red_flags.some((f) => f.includes("Usage collision"))).toBe(true);
    expect(res.red_flags.join(" ")).toContain(star.name);
  });

  it("fires a pace-mismatch red flag for a 3+ possession gap", () => {
    // UTA (104.0 pace) vs BOS (96.5 pace) in the real team data
    const p = makePlayer({ team: "UTA", usg: 20 });
    const res = teamChemistry(p, "BOS");
    expect(res.red_flags.some((f) => f.includes("Pace mismatch"))).toBe(true);
  });

  it("best_team_matches returns top-5 teams sorted by fit, excluding own team", () => {
    const p = PLAYERS[0];
    const matches = best_team_matches(p);
    expect(matches).toHaveLength(5);
    expect(matches.every((m) => m.team.abbr !== p.team)).toBe(true);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].fit).toBeGreaterThanOrEqual(matches[i].fit);
    }
    // identical fits to running the model directly
    expect(matches[0].fit).toBe(teamChemistry(p, matches[0].team.abbr).fit);
  });
});

describe("pickAndRoll", () => {
  const handler = makePlayer({ pos: "PG", apg: 9, tpp: 0.38, topg: 3, offImpact: 70, name: "Handler One" });
  const rimRunner = makePlayer({ pos: "C", shotRim: 0.75, shotMid: 0.1, shotThree: 0.03, tsp: 0.68, apg: 1, name: "Rim Runner" });
  const stretchBig = makePlayer({ pos: "C", shotRim: 0.35, shotMid: 0.2, shotThree: 0.45, tsp: 0.6, apg: 2, name: "Stretch Big" });

  it("gives a rim-running C a higher lob rate than a stretch big", () => {
    const rim = pickAndRoll(handler, rimRunner);
    const str = pickAndRoll(handler, stretchBig);
    expect(rim.lob_rate).toBeGreaterThan(str.lob_rate);
    expect(rim.lob_rate).toBeGreaterThanOrEqual(0);
    expect(rim.lob_rate).toBeLessThanOrEqual(100);
    expect(str.short_roll_efficiency).toBeGreaterThanOrEqual(0);
    expect(str.short_roll_efficiency).toBeLessThanOrEqual(100);
  });

  it("names both players in the tactical explanation and keeps the ppp clamp", () => {
    const res = pickAndRoll(handler, rimRunner);
    expect(res.tactical_explanation).toContain("Handler One");
    expect(res.tactical_explanation).toContain("Rim Runner");
    expect(res.ppp).toBeGreaterThanOrEqual(0.78);
    expect(res.ppp).toBeLessThanOrEqual(1.32);
  });
});

describe("playTypeMix / teamPlayTypeMix", () => {
  it("attaches an alternative-labels confidence note to every play type", () => {
    const mix = playTypeMix(makePlayer({ pos: "PG", apg: 8 }));
    expect(mix.length).toBeGreaterThan(0);
    for (const m of mix) {
      expect(m.alternative_labels).toContain("label agreement");
    }
  });

  it("blends a real roster into a usage-weighted team mix", () => {
    const mix = teamPlayTypeMix("BOS");
    expect(mix.length).toBeGreaterThan(0);
    const total = mix.reduce((a, m) => a + m.freq, 0);
    expect(total).toBeGreaterThanOrEqual(90);
    expect(total).toBeLessThanOrEqual(110);
    // sorted by frequency, descending
    for (let i = 1; i < mix.length; i++) {
      expect(mix[i - 1].freq).toBeGreaterThanOrEqual(mix[i].freq);
    }
    for (const m of mix) {
      expect(m.ppp).toBeGreaterThan(0);
      expect(m.alternative_labels).toContain("label agreement");
    }
  });

  it("returns an empty mix for an unknown team", () => {
    expect(teamPlayTypeMix("XXX")).toEqual([]);
  });
});

// ---------------- draft picks in trades ----------------
import { DRAFT_BASE_YEAR } from "@/lib/engine/teams";

describe("evaluateTrade with draft picks", () => {
  it("treats a pick-only trade as salary-legal for both teams", () => {
    // NYK sits above the 2nd apron, but a pick swap moves zero salary
    const res = evaluateTrade([
      {
        team: "NYK",
        outgoing: [],
        incoming: [],
        picks: [{ year: DRAFT_BASE_YEAR + 1, round: 1 }],
        picksIn: [{ year: DRAFT_BASE_YEAR + 2, round: 2 }],
      },
      {
        team: "MEM",
        outgoing: [],
        incoming: [],
        picks: [{ year: DRAFT_BASE_YEAR + 2, round: 2 }],
        picksIn: [{ year: DRAFT_BASE_YEAR + 1, round: 1 }],
      },
    ]);
    expect(res.legal).toBe(true);
    expect(res.violations).toEqual([]);
    for (const s of res.sides) {
      expect(s.out).toBe(0);
      expect(s.in).toBe(0);
      expect(s.netSalary).toBe(0);
      expect(s.matchOk).toBe(true);
      expect(s.failure_reasons).toEqual([]);
    }
  });

  it("values a protected 1st below an unprotected 1st, with a nearness premium", () => {
    const farYear = DRAFT_BASE_YEAR + 3; // outside the 2-year nearness window
    const run = (pick: { year: number; round: 1 | 2; protected?: boolean }) =>
      evaluateTrade([
        { team: "BKN", outgoing: [], incoming: [], picksIn: [pick] },
        { team: "MEM", outgoing: [], incoming: [], picks: [pick] },
      ]).sides.find((s) => s.team.abbr === "BKN")!;
    const unprot = run({ year: farYear, round: 1 });
    const prot = run({ year: farYear, round: 1, protected: true });
    const second = run({ year: farYear, round: 2 });
    expect(unprot.talentDelta).toBe(9);
    expect(prot.talentDelta).toBe(6);
    expect(second.talentDelta).toBe(2.5);
    expect(prot.talentDelta).toBeLessThan(unprot.talentDelta);
    // a 1st in the very next draft carries the full +1 nearness premium
    const near = run({ year: DRAFT_BASE_YEAR, round: 1 });
    expect(near.talentDelta).toBe(10);
    // the receiving side's note surfaces the pick value
    expect(near.note).toContain("pick value +10");
    // and the sending side mirrors it as a negative delta
    const memSide = evaluateTrade([
      { team: "BKN", outgoing: [], incoming: [], picksIn: [{ year: farYear, round: 1 }] },
      { team: "MEM", outgoing: [], incoming: [], picks: [{ year: farYear, round: 1 }] },
    ]).sides.find((s) => s.team.abbr === "MEM")!;
    expect(memSide.talentDelta).toBe(-9);
  });

  it("formats picks_out / picks_in label summaries", () => {
    const picks = [
      { year: 2027, round: 1 as const, protected: true },
      { year: 2026, round: 2 as const },
    ];
    const res = evaluateTrade([
      { team: "BKN", outgoing: [], incoming: [], picks, picksIn: [] },
      { team: "MEM", outgoing: [], incoming: [], picks: [], picksIn: picks },
    ]);
    const bkn = res.sides.find((s) => s.team.abbr === "BKN")!;
    expect(bkn.picks_out).toEqual(["2027 1st (protected)", "2026 2nd"]);
    expect(bkn.picks_in).toEqual([]);
    const mem = res.sides.find((s) => s.team.abbr === "MEM")!;
    expect(mem.picks_in).toEqual(["2027 1st (protected)", "2026 2nd"]);
    expect(mem.picks_out).toEqual([]);
    // sides without picks keep empty summaries
    const noPicks = evaluateTrade([
      { team: "BKN", outgoing: [makePlayer({ salary: 10 })], incoming: [] },
      { team: "MEM", outgoing: [], incoming: [makePlayer({ salary: 10 })] },
    ]);
    for (const s of noPicks.sides) {
      expect(s.picks_out).toEqual([]);
      expect(s.picks_in).toEqual([]);
    }
  });
});
