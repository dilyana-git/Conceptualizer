/**
 * Statistical power — PURE simulation module. SPEC §3.3.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13)
 * ---------------------------------------------------------------------------
 * Two independent groups of size n, common standard deviation, compared by
 * their difference in means. Everything is expressed in standardised units, so
 * the true effect is Cohen's d and the estimate d-hat has standard error
 *
 *     se = sqrt(2/n)
 *
 * Under the null d-hat ~ N(0, se); under the alternative d-hat ~ N(d, se).
 * Writing the noncentrality in z units, ncp = d/se = d*sqrt(n/2), and with
 * critical value c (z_{1-alpha/2} two-tailed, z_{1-alpha} one-tailed):
 *
 *     power(two-tailed) = Phi(ncp - c) + Phi(-ncp - c)
 *     power(one-tailed) = Phi(ncp - c)
 *
 * The second term of the two-tailed form is the probability of landing
 * significant on the *wrong side*, which is the Type S (sign) error rate of
 * Gelman & Carlin, "Beyond Power Calculations", Perspectives on Psychological
 * Science 9 (2014):
 *
 *     TypeS = Phi(-ncp - c) / power
 *
 * The same paper's Type M (exaggeration) ratio is the expected magnitude of a
 * significant estimate divided by the true effect. For Z ~ N(ncp, 1),
 *
 *     E[|Z| . 1{|Z|>c}] = ncp*(1 - Phi(c - ncp)) + phi(c - ncp)
 *                         - ncp*Phi(-c - ncp)    + phi(c + ncp)
 *     TypeM = E[|Z| | significant] / ncp
 *
 * which is derived from the standard truncated-normal moment
 * integral(a..inf) z phi(z - m) dz = m(1 - Phi(a - m)) + phi(a - m).
 * ---------------------------------------------------------------------------
 */
import { normalCdf, normalPdf, normalQuantile } from '../../lib/stats';

export type Tails = 'one' | 'two';

export interface PowerInputs {
  /** True effect size, Cohen's d. */
  effect: number;
  /** Sample size per group. */
  n: number;
  /** Significance level. */
  alpha: number;
  tails: Tails;
}

export interface PowerOutcome {
  /** Standard error of the estimated effect, in effect-size units. */
  se: number;
  /** Noncentrality: the true effect measured in standard errors. */
  ncp: number;
  /** Critical value in z units. */
  criticalZ: number;
  /** Critical value in effect-size units (the positive threshold). */
  criticalEffect: number;
  power: number;
  /** Probability of a significant result with the wrong sign, given significance. */
  typeS: number;
  /** Expected magnitude of a significant estimate, divided by the truth. */
  typeM: number;
  /** Sample size per group needed for 80% power at this effect and alpha. */
  nFor80: number;
}

export function standardError(n: number): number {
  return Math.sqrt(2 / n);
}

export function criticalZFor(alpha: number, tails: Tails): number {
  return tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
}

export function powerFor(effect: number, n: number, alpha: number, tails: Tails): number {
  const ncp = effect / standardError(n);
  const c = criticalZFor(alpha, tails);
  const upper = normalCdf(ncp - c);
  if (tails === 'one') return upper;
  return upper + normalCdf(-ncp - c);
}

/**
 * Smallest per-group n reaching 80% power, by bisection on the (monotone)
 * power curve. Returns Infinity when the effect is zero, where no n suffices.
 */
export function sampleSizeFor80(effect: number, alpha: number, tails: Tails): number {
  if (effect <= 0) return Infinity;
  let lo = 2;
  let hi = 4;
  while (powerFor(effect, hi, alpha, tails) < 0.8) {
    hi *= 2;
    if (hi > 1e7) return Infinity;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (powerFor(effect, mid, alpha, tails) < 0.8) lo = mid;
    else hi = mid;
  }
  return hi;
}

export function solve(inputs: PowerInputs): PowerOutcome {
  const { effect, n, alpha, tails } = inputs;
  const se = standardError(n);
  const ncp = effect / se;
  const criticalZ = criticalZFor(alpha, tails);
  const power = powerFor(effect, n, alpha, tails);

  // Wrong-sign significance only exists for a two-tailed test.
  const wrongSide = tails === 'two' ? normalCdf(-ncp - criticalZ) : 0;
  const typeS = power > 0 ? wrongSide / power : 0;

  // Truncated first absolute moment of the significant region.
  const expectedMagnitude =
    ncp * (1 - normalCdf(criticalZ - ncp)) +
    normalPdf(criticalZ - ncp) +
    (tails === 'two' ? -ncp * normalCdf(-criticalZ - ncp) + normalPdf(criticalZ + ncp) : 0);

  const typeM = ncp > 0 && power > 0 ? expectedMagnitude / power / ncp : 1;

  return {
    se,
    ncp,
    criticalZ,
    criticalEffect: criticalZ * se,
    power,
    typeS,
    typeM,
    nFor80: sampleSizeFor80(effect, alpha, tails),
  };
}

/** Density of the estimate under the null, in effect-size units. */
export function nullDensity(x: number, se: number): number {
  return normalPdf(x, 0, se);
}

/** Density of the estimate under the alternative. */
export function altDensity(x: number, effect: number, se: number): number {
  return normalPdf(x, effect, se);
}

export interface Curve {
  x: number;
  y: number;
}

export function sampleCurve(
  density: (x: number) => number,
  from: number,
  to: number,
  samples = 240,
): Curve[] {
  const out: Curve[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = from + ((to - from) * i) / samples;
    out.push({ x, y: density(x) });
  }
  return out;
}

/** §9: what the chart currently shows. */
export function describe(inputs: PowerInputs, outcome: PowerOutcome): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const tailWord = inputs.tails === 'two' ? 'two-tailed' : 'one-tailed';

  if (inputs.effect === 0) {
    return (
      `With no true effect, a ${tailWord} test at alpha ${inputs.alpha} rejects the null ` +
      `${pct(inputs.alpha)} of the time by construction. Every one of those is a false positive.`
    );
  }

  const verdict =
    outcome.power >= 0.8
      ? 'This study is adequately powered.'
      : outcome.power >= 0.5
        ? 'This study is underpowered: it will miss the effect more often than a coin flip would allow.'
        : 'This study is severely underpowered.';

  const exaggeration =
    outcome.typeM > 1.15
      ? ` A significant result here overstates the effect by about ${outcome.typeM.toFixed(1)} times on average.`
      : '';

  const sign =
    outcome.typeS > 0.01
      ? ` ${pct(outcome.typeS)} of significant results would even have the wrong sign.`
      : '';

  const needed = Number.isFinite(outcome.nFor80)
    ? ` Reaching 80% power would need ${outcome.nFor80} per group.`
    : '';

  return (
    `True effect d = ${inputs.effect.toFixed(2)}, ${inputs.n} per group, ${tailWord} at ` +
    `alpha ${inputs.alpha}. Power is ${pct(outcome.power)}. ${verdict}${exaggeration}${sign}${needed}`
  );
}
