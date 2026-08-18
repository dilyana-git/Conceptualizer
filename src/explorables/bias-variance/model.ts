/**
 * The bias-variance decomposition — PURE simulation module. SPEC §3.3.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13)
 * ---------------------------------------------------------------------------
 * A fixed target f is sampled at n evenly spaced points with independent noise
 * of standard deviation sigma, and a polynomial of the chosen degree is fitted
 * by least squares. Repeating the draw R times gives R different fitted curves,
 * and the spread between them is the whole point.
 *
 * The x positions are the same in every draw — a *fixed design*, so the only
 * thing that varies between draws is the noise. That is deliberate. With x
 * drawn at random the points cluster by chance, and at high degree the fit is
 * close enough to interpolation that a single unlucky cluster sends the curve
 * to 1e5 and beyond. Those numbers are real, but they are a lesson about the
 * conditioning of near-interpolation rather than about bias and variance, and
 * they make the plot unreadable. Holding the design fixed isolates the effect
 * the explorable is actually about.
 *
 * At any x, writing fbar(x) for the average fitted value across the R draws:
 *
 *     bias(x)     = fbar(x) - f(x)
 *     variance(x) = mean_r ( fhat_r(x) - fbar(x) )^2
 *
 * and the mean squared distance of the fits from the truth splits exactly:
 *
 *     mean_r ( fhat_r(x) - f(x) )^2  =  bias(x)^2 + variance(x)
 *
 * This is an algebraic identity for any finite collection of numbers, not an
 * approximation that needs many draws — which is why the test can assert it to
 * floating-point precision rather than statistically. Adding the irreducible
 * noise gives the expected error on a fresh observation at x:
 *
 *     E[(y - fhat(x))^2] = bias(x)^2 + variance(x) + sigma^2
 *
 * cf. Geman, Bienenstock & Doursat, "Neural Networks and the Bias/Variance
 * Dilemma", Neural Computation 4 (1992); Hastie, Tibshirani & Friedman,
 * "Elements of Statistical Learning", §2.9 and §7.3.
 *
 * Fitting is least squares on a Vandermonde basis in x rescaled to [-1, 1],
 * solved by modified Gram-Schmidt QR rather than by the normal equations.
 *
 * That choice is not fastidiousness. Forming A^T A squares the condition number
 * of A, and at degree 7 on a dozen clustered random points that was enough to
 * lose the defining property of a least-squares fit: raising the degree made
 * the *training* error go up, which is impossible for an exact solve. QR works
 * on A directly and keeps the fits monotone in degree as they must be.
 * Rescaling to [-1, 1] matters for the same reason — the Vandermonde basis on
 * [0, 1] is far worse conditioned.
 * ---------------------------------------------------------------------------
 */
import { mulberry32, normalSampler } from '../../lib/stats';

export const MAX_DEGREE = 9;
/** Points at which curves are drawn and the decomposition is evaluated. */
export const GRID = 120;

export interface BiasVarianceInputs {
  /** Polynomial degree; 0 is a constant. */
  degree: number;
  /** Standard deviation of the observation noise. */
  noise: number;
  /** Training points per draw. */
  trainSize: number;
  /** How many independent training sets to draw. */
  resamples: number;
  sample: number;
}

export interface Fit {
  /** Coefficients in the rescaled basis, lowest order first. */
  coefficients: number[];
  /** Training points this fit was made from. */
  points: { x: number; y: number }[];
  /** Mean squared error on its own training points. */
  trainError: number;
}

export interface BiasVarianceOutcome {
  fits: Fit[];
  /** x positions of the evaluation grid, over [0, 1]. */
  grid: number[];
  /** The target curve on the grid. */
  truth: number[];
  /** Every fitted curve on the grid. */
  curves: number[][];
  /** The average fitted curve. */
  average: number[];
  /** Squared bias, averaged over the grid. */
  bias2: number;
  /** Variance, averaged over the grid. */
  variance: number;
  /** sigma^2 — the part no model can remove. */
  irreducible: number;
  /** bias2 + variance + irreducible. */
  expectedError: number;
  /** Mean training error across the draws. */
  trainError: number;
}

/** The target. Fixed, so that "bias" always means distance from this curve. */
export function targetFunction(x: number): number {
  return 0.9 * Math.sin(2 * Math.PI * x);
}

/** Map [0,1] onto [-1,1], where the Vandermonde basis is well conditioned. */
function rescale(x: number): number {
  return 2 * x - 1;
}

/**
 * Solve an upper-triangular system R c = b by back substitution.
 * Returns null if R is singular to working precision.
 */
export function solveUpperTriangular(r: number[][], b: readonly number[]): number[] | null {
  const n = b.length;
  const out = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    const diagonal = r[i]![i]!;
    if (Math.abs(diagonal) < 1e-11) return null;
    let sum = b[i]!;
    for (let j = i + 1; j < n; j++) sum -= r[i]![j]! * out[j]!;
    out[i] = sum / diagonal;
  }
  return out;
}

/**
 * Least-squares polynomial fit by modified Gram-Schmidt QR.
 *
 * Returns coefficients in the rescaled basis. When the system is rank deficient
 * — fewer points than coefficients, or duplicated x values — it falls back to
 * the sample mean rather than emitting infinities.
 */
export function polyFit(
  xs: readonly number[],
  ys: readonly number[],
  degree: number,
): number[] {
  const terms = degree + 1;
  const n = xs.length;
  const fallback = () => {
    const out = new Array<number>(terms).fill(0);
    out[0] = n === 0 ? 0 : ys.reduce((s, y) => s + y, 0) / n;
    return out;
  };
  if (n === 0 || n < terms) return fallback();

  // Columns of the Vandermonde matrix, each of length n.
  const columns: number[][] = [];
  for (let k = 0; k < terms; k++) {
    columns.push(
      k === 0
        ? new Array<number>(n).fill(1)
        : columns[k - 1]!.map((v, i) => v * rescale(xs[i]!)),
    );
  }

  // Modified Gram-Schmidt: orthonormalise the columns in place, recording R.
  const r: number[][] = Array.from({ length: terms }, () => new Array<number>(terms).fill(0));
  const q: number[][] = columns.map((c) => [...c]);

  for (let k = 0; k < terms; k++) {
    let norm = Math.sqrt(q[k]!.reduce((s, v) => s + v * v, 0));
    if (!Number.isFinite(norm) || norm < 1e-11) return fallback();
    r[k]![k] = norm;
    for (let i = 0; i < n; i++) q[k]![i]! /= norm;

    for (let j = k + 1; j < terms; j++) {
      let dot = 0;
      for (let i = 0; i < n; i++) dot += q[k]![i]! * q[j]![i]!;
      r[k]![j] = dot;
      for (let i = 0; i < n; i++) q[j]![i]! -= dot * q[k]![i]!;
    }
  }

  // Right-hand side Q^T y, then back substitution.
  const qty = q.map((column) => {
    let dot = 0;
    for (let i = 0; i < n; i++) dot += column[i]! * ys[i]!;
    return dot;
  });

  return solveUpperTriangular(r, qty) ?? fallback();
}

export function polyEval(coefficients: readonly number[], x: number): number {
  const z = rescale(x);
  let acc = 0;
  for (let k = coefficients.length - 1; k >= 0; k--) acc = acc * z + coefficients[k]!;
  return acc;
}

export function solve(inputs: BiasVarianceInputs): BiasVarianceOutcome {
  const { degree, noise, trainSize, resamples, sample } = inputs;
  const rng = mulberry32(sample * 104729 + trainSize * 7919 + resamples * 31);
  const nextNormal = normalSampler(rng);

  const grid = Array.from({ length: GRID }, (_, i) => i / (GRID - 1));
  const truth = grid.map(targetFunction);

  const fits: Fit[] = [];
  const curves: number[][] = [];

  for (let r = 0; r < resamples; r++) {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < trainSize; i++) {
      // Evenly spaced across [0,1], inset by half a step so no point sits
      // exactly on the boundary where polynomial fits are worst behaved.
      const x = (i + 0.5) / trainSize;
      points.push({ x, y: targetFunction(x) + noise * nextNormal() });
    }
    const coefficients = polyFit(points.map((p) => p.x), points.map((p) => p.y), degree);

    const trainError =
      points.reduce((s, p) => s + (p.y - polyEval(coefficients, p.x)) ** 2, 0) /
      Math.max(1, points.length);

    fits.push({ coefficients, points, trainError });
    curves.push(grid.map((x) => polyEval(coefficients, x)));
  }

  // Average fitted curve, then the decomposition, pointwise then averaged.
  const average = grid.map((_, i) =>
    curves.length === 0 ? 0 : curves.reduce((s, c) => s + c[i]!, 0) / curves.length,
  );

  let bias2 = 0;
  let variance = 0;
  for (let i = 0; i < grid.length; i++) {
    bias2 += (average[i]! - truth[i]!) ** 2;
    if (curves.length > 0) {
      variance += curves.reduce((s, c) => s + (c[i]! - average[i]!) ** 2, 0) / curves.length;
    }
  }
  bias2 /= grid.length;
  variance /= grid.length;

  const irreducible = noise * noise;

  return {
    fits,
    grid,
    truth,
    curves,
    average,
    bias2,
    variance,
    irreducible,
    expectedError: bias2 + variance + irreducible,
    trainError: fits.length === 0 ? 0 : fits.reduce((s, f) => s + f.trainError, 0) / fits.length,
  };
}

/** §9: what the chart currently shows. */
export function describe(inputs: BiasVarianceInputs, outcome: BiasVarianceOutcome): string {
  const n = (v: number) => v.toFixed(3);
  const dominant =
    outcome.bias2 > outcome.variance * 1.5
      ? 'Bias dominates: the model is too rigid to follow the target, and every draw misses it the same way.'
      : outcome.variance > outcome.bias2 * 1.5
        ? 'Variance dominates: each draw produces a wildly different curve, so the fit is chasing the noise.'
        : 'Bias and variance are roughly balanced, which is close to where total error is lowest.';

  return (
    `Degree ${inputs.degree} fitted to ${inputs.resamples} independent samples of ` +
    `${inputs.trainSize} points, noise ${n(inputs.noise)}. ` +
    `Squared bias ${n(outcome.bias2)}, variance ${n(outcome.variance)}, ` +
    `irreducible ${n(outcome.irreducible)}, expected error ${n(outcome.expectedError)}. ` +
    `Training error is ${n(outcome.trainError)}. ${dominant}`
  );
}
