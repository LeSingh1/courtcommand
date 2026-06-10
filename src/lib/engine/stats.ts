// Small-sample statistics shared across tools.
//
// The playoff corpus is 89 games; most player splits are under 30 attempts.
// Raw rates at those samples are mostly noise, so every leaderboard rate
// should be shrunk toward a sensible prior — the principled version of
// "dimming small samples."

/**
 * Empirical-Bayes shrinkage: pull an observed rate toward a prior, weighted
 * by sample size. `k` is the prior's weight in pseudo-observations — the
 * sample size at which we trust data and prior equally.
 *
 *   estimate = (n·observed + k·prior) / (n + k)
 */
export function ebShrink(observed: number, n: number, prior: number, k: number): number {
  if (n <= 0) return prior;
  if (k <= 0) return observed;
  return (n * observed + k * prior) / (n + k);
}

/**
 * Wilson score interval for a binomial rate — behaves sensibly at small n
 * (unlike the normal approximation, it never leaves [0, 1]).
 */
export function wilsonCI(made: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1];
  const p = made / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/**
 * Shrink a signed per-event delta toward zero (e.g. shot-making over
 * expected): the multiplier n/(n+k) keeps direction but discounts thin
 * samples all the way to zero.
 */
export function shrinkToZero(delta: number, n: number, k: number): number {
  if (n <= 0) return 0;
  return delta * (n / (n + k));
}
