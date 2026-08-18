import { describe, expect, it } from 'vitest';
import {
  GRID,
  polyEval,
  polyFit,
  solve,
  solveUpperTriangular,
  targetFunction,
  type BiasVarianceInputs,
} from './model';

const base: BiasVarianceInputs = {
  degree: 3,
  noise: 0.2,
  trainSize: 15,
  resamples: 40,
  sample: 1,
};

describe('triangular solver', () => {
  it('back-substitutes correctly', () => {
    // [2 1; 0 3] c = [5; 6]  ->  c = [1; 2]
    const out = solveUpperTriangular(
      [
        [2, 1],
        [0, 3],
      ],
      [4, 6],
    );
    expect(out).not.toBeNull();
    expect(out![0]!).toBeCloseTo(1, 10);
    expect(out![1]!).toBeCloseTo(2, 10);
  });

  it('reports singularity rather than dividing by zero', () => {
    expect(
      solveUpperTriangular(
        [
          [1, 2],
          [0, 0],
        ],
        [3, 1],
      ),
    ).toBeNull();
  });
});

describe('polynomial fitting', () => {
  it('recovers a polynomial exactly when the data is noise-free', () => {
    // y = 1 - 2x + 4x^2 sampled at 12 points, fitted at degree 2.
    const xs = Array.from({ length: 12 }, (_, i) => i / 11);
    const f = (x: number) => 1 - 2 * x + 4 * x * x;
    const ys = xs.map(f);
    const coefficients = polyFit(xs, ys, 2);
    for (const x of [0, 0.17, 0.5, 0.83, 1]) {
      expect(polyEval(coefficients, x)).toBeCloseTo(f(x), 9);
    }
  });

  it('reduces to the sample mean at degree zero', () => {
    const xs = [0.1, 0.4, 0.6, 0.9];
    const ys = [1, 3, 2, 6];
    const coefficients = polyFit(xs, ys, 0);
    expect(polyEval(coefficients, 0.5)).toBeCloseTo(3, 10);
  });

  it('stays well conditioned at the maximum degree', () => {
    // Rescaling x to [-1,1] is what makes this work; on [0,1] the degree-9
    // normal equations lose enough precision to show up here.
    const xs = Array.from({ length: 40 }, (_, i) => i / 39);
    const ys = xs.map(targetFunction);
    const coefficients = polyFit(xs, ys, 9);
    for (const x of [0.05, 0.3, 0.55, 0.8, 0.95]) {
      expect(polyEval(coefficients, x)).toBeCloseTo(targetFunction(x), 4);
    }
  });

  it('fits through every point when the degree matches the sample size', () => {
    const xs = [0.1, 0.35, 0.6, 0.85];
    const ys = [0.5, -0.2, 0.8, 0.1];
    const coefficients = polyFit(xs, ys, 3);
    for (let i = 0; i < xs.length; i++) {
      expect(polyEval(coefficients, xs[i]!)).toBeCloseTo(ys[i]!, 8);
    }
  });
});

describe('the decomposition identity', () => {
  // The central claim: mean squared distance from the truth splits exactly into
  // squared bias plus variance. This is algebra, not a limit, so it holds to
  // floating-point precision for any number of draws.
  it('splits mean squared error into bias squared plus variance, exactly', () => {
    for (const inputs of [
      base,
      { ...base, degree: 0 },
      { ...base, degree: 9, trainSize: 12 },
      { ...base, noise: 0, resamples: 10 },
      { ...base, resamples: 1 },
    ]) {
      const out = solve(inputs);

      let mse = 0;
      for (let i = 0; i < out.grid.length; i++) {
        mse +=
          out.curves.reduce((s, c) => s + (c[i]! - out.truth[i]!) ** 2, 0) / out.curves.length;
      }
      mse /= out.grid.length;

      // Compared relatively: the identity is exact in real arithmetic, so what
      // is being checked is that nothing beyond float rounding creeps in.
      const sum = out.bias2 + out.variance;
      expect(Math.abs(mse - sum)).toBeLessThan(1e-12 * Math.max(1, Math.abs(sum)));
    }
  });

  it('adds the irreducible noise to reach expected error', () => {
    const out = solve(base);
    expect(out.irreducible).toBeCloseTo(base.noise ** 2, 12);
    expect(out.expectedError).toBeCloseTo(out.bias2 + out.variance + out.irreducible, 12);
  });

  it('collapses variance to zero with a single draw', () => {
    const out = solve({ ...base, resamples: 1 });
    expect(out.variance).toBeCloseTo(0, 12);
  });

  it('keeps every component non-negative', () => {
    for (const degree of [0, 1, 3, 6, 9]) {
      for (const noise of [0, 0.2, 0.5]) {
        const out = solve({ ...base, degree, noise });
        expect(out.bias2).toBeGreaterThanOrEqual(0);
        expect(out.variance).toBeGreaterThanOrEqual(0);
        expect(out.irreducible).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('the trade-off itself', () => {
  it('trades bias for variance as the degree rises', () => {
    const rigid = solve({ ...base, degree: 0, trainSize: 20 });
    const flexible = solve({ ...base, degree: 9, trainSize: 20 });

    // A constant cannot follow a sine: high bias, almost no variance.
    expect(rigid.bias2).toBeGreaterThan(rigid.variance);
    // A degree-9 fit chases the noise: the bias is gone, the spread is not.
    expect(flexible.variance).toBeGreaterThan(flexible.bias2);
    expect(flexible.variance).toBeGreaterThan(rigid.variance);
    expect(flexible.bias2).toBeLessThan(rigid.bias2);
  });

  it('moves bias and variance monotonically in opposite directions', () => {
    const runs = [0, 1, 3, 5, 7, 9].map((degree) => solve({ ...base, degree, trainSize: 20 }));
    for (let i = 1; i < runs.length; i++) {
      // More flexibility can only reduce (or hold) the bias of the average fit,
      // and can only increase the spread between fits.
      expect(runs[i]!.bias2).toBeLessThanOrEqual(runs[i - 1]!.bias2 + 1e-9);
      expect(runs[i]!.variance).toBeGreaterThanOrEqual(runs[i - 1]!.variance - 1e-9);
    }
  });

  it('lets training error keep falling while expected error turns back up', () => {
    const degrees = [0, 1, 2, 3, 5, 7, 9];
    const runs = degrees.map((degree) => solve({ ...base, degree, trainSize: 20 }));

    // Training error is non-increasing in degree: more freedom always fits the
    // points it was given at least as well.
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]!.trainError).toBeLessThanOrEqual(runs[i - 1]!.trainError + 1e-9);
    }

    // Expected error is U-shaped: its minimum is at neither extreme.
    const errors = runs.map((r) => r.expectedError);
    const best = errors.indexOf(Math.min(...errors));
    expect(best).toBeGreaterThan(0);
    expect(best).toBeLessThan(errors.length - 1);
  });

  it('reduces variance when more training data is available', () => {
    const small = solve({ ...base, degree: 7, trainSize: 10 });
    const large = solve({ ...base, degree: 7, trainSize: 60 });
    expect(large.variance).toBeLessThan(small.variance);
  });

  it('leaves bias untouched by the noise level', () => {
    // Noise moves variance and the irreducible term, but the average fit of a
    // too-rigid model misses the target by the same shape regardless.
    const quiet = solve({ ...base, degree: 1, noise: 0, resamples: 60 });
    const loud = solve({ ...base, degree: 1, noise: 0.4, resamples: 60 });
    expect(loud.bias2).toBeCloseTo(quiet.bias2, 1);
    expect(loud.variance).toBeGreaterThan(quiet.variance);
  });

  it('is deterministic in its inputs', () => {
    expect(solve(base).bias2).toBe(solve(base).bias2);
    expect(solve(base).curves).toEqual(solve(base).curves);
    expect(solve(base).grid).toHaveLength(GRID);
  });
});
