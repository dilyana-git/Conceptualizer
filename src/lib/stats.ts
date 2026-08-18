/**
 * Shared numerical helpers for the statistics explorables.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists (a departure from the SPEC §3.2 layout)
 * ---------------------------------------------------------------------------
 * §3.2 gives every explorable its own `model.ts` and nothing shared beneath it.
 * That works while each model is self-contained, but four statistics
 * explorables all need a normal CDF and a seeded generator, and three copies of
 * an erf approximation is three chances to get it subtly wrong in one place
 * only. §13 says to extend the abstraction rather than reach around it, so this
 * is the extension: pure numerics, no React, no DOM, no explorable-specific
 * knowledge. Anything that knows about a particular model still belongs in that
 * model's own `model.ts`.
 * ---------------------------------------------------------------------------
 */

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-randomness
 *
 * §0 forbids nondeterminism, and §3.3 requires models be pure functions of
 * their arguments. So every "sample" on this site is drawn from a seeded
 * generator: the same parameters always produce the same dataset, a shared URL
 * reproduces the sharer's exact sample, and a model test can assert a number.
 * ------------------------------------------------------------------ */

/**
 * mulberry32 — a small, fast 32-bit PRNG with a full 2^32 period.
 * Public domain (Tommy Ettinger). Chosen over an LCG because the low bits of a
 * naive LCG are visibly patterned, which shows up as stripes in a scatter plot.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal deviates by the Box–Muller transform.
 * Returns a generator so consecutive draws stay in a reproducible sequence.
 */
export function normalSampler(rng: () => number): () => number {
  let spare: number | null = null;
  return function nextNormal(): number {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    // Guard against log(0); rng() can return exactly 0.
    const u1 = Math.max(rng(), Number.MIN_VALUE);
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spare = r * Math.sin(theta);
    return r * Math.cos(theta);
  };
}

/** Exponential deviate with rate `lambda`, by inverse transform. */
export function exponentialFrom(u: number, lambda: number): number {
  return -Math.log(Math.max(1 - u, Number.MIN_VALUE)) / lambda;
}

/* ------------------------------------------------------------------ *
 * The normal distribution
 * ------------------------------------------------------------------ */

export function normalPdf(x: number, mean = 0, sd = 1): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/**
 * Standard normal CDF.
 *
 * Uses the rational approximation of Abramowitz & Stegun 26.2.17 (Zelen &
 * Severo), whose stated absolute error is below 7.5e-8 — ample for reporting a
 * power figure to three decimals, and cheap enough to call thousands of times
 * per frame.
 */
export function normalCdf(x: number, mean = 0, sd = 1): number {
  const z = (x - mean) / sd;
  const sign = z < 0 ? -1 : 1;
  const a = Math.abs(z) / Math.SQRT2;

  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-a * a);

  return 0.5 * (1 + sign * erf);
}

/** Upper tail, 1 - Φ(x). Written separately to keep the caller's intent clear. */
export function normalSf(x: number, mean = 0, sd = 1): number {
  return 1 - normalCdf(x, mean, sd);
}

/**
 * Inverse standard normal CDF (the quantile function).
 *
 * Peter Acklam's rational approximation, relative error below 1.15e-9 across
 * the open interval. Used for critical values, where a sloppy inverse would
 * shift the whole decision threshold.
 */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p > pHigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  q = p - 0.5;
  r = q * q;
  return (
    ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}

/* ------------------------------------------------------------------ *
 * Small descriptive helpers
 * ------------------------------------------------------------------ */

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

export interface Line {
  slope: number;
  intercept: number;
}

/** Ordinary least squares fit of y on x. */
export function olsLine(xs: readonly number[], ys: readonly number[]): Line {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: n === 1 ? ys[0]! : 0 };
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    sxy += dx * (ys[i]! - my);
    sxx += dx * dx;
  }
  if (sxx === 0) return { slope: 0, intercept: my };
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
