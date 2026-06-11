import { it, expect } from "vitest";
import { titleOdds } from "@/lib/engine/content";
it("exact title odds sum to ~100 and favor the strongest team", () => {
  const odds = titleOdds("balanced");
  const sum = odds.reduce((a, o) => a + o.title, 0);
  expect(Math.abs(sum - 100)).toBeLessThan(1.5);
  expect(odds[0].title).toBeGreaterThan(odds[odds.length - 1].title);
  const semisSum = odds.reduce((a, o) => a + o.semis, 0);
  expect(Math.abs(semisSum - 400)).toBeLessThan(3); // four final-four slots
});
