import { describe, expect, it } from 'vitest';
import {
  exponentialFrom,
  mean,
  mulberry32,
  normalCdf,
  normalPdf,
  normalQuantile,
  normalSampler,
  normalSf,
  olsLine,
} from './stats';

describe('deterministic randomness', () => {
  it('gives the same stream for the same seed, and a different one otherwise', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    const seqC = Array.from({ length: 5 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('stays inside [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const u = rng();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it('produces standard normals with the right first two moments', () => {
    const n = 200_000;
    const next = normalSampler(mulberry32(2024));
    const xs = Array.from({ length: n }, next);
    const m = mean(xs);
    const v = mean(xs.map((x) => (x - m) ** 2));
    // Bounds are the sampling standard errors of these estimators, not round
    // decimal places: for a true standard normal, se(mean) = 1/sqrt(n) and
    // se(variance) = sqrt(2/n). Four standard errors is a ~1-in-16,000 flake.
    expect(Math.abs(m)).toBeLessThan(4 / Math.sqrt(n));
    expect(Math.abs(v - 1)).toBeLessThan(4 * Math.sqrt(2 / n));
  });

  it('inverts the exponential CDF', () => {
    // F(t) = 1 - exp(-lambda t), so F(exponentialFrom(u)) must return u.
    for (const u of [0.1, 0.25, 0.5, 0.9, 0.99]) {
      const t = exponentialFrom(u, 0.3);
      expect(1 - Math.exp(-0.3 * t)).toBeCloseTo(u, 12);
    }
    // The median of an exponential is ln(2)/lambda.
    expect(exponentialFrom(0.5, Math.LN2 / 12)).toBeCloseTo(12, 10);
  });
});

describe('normal distribution', () => {
  it('matches published CDF values within the approximation\'s stated bound', () => {
    // A&S 26.2.17 documents |error| < 7.5e-8. Asserting against that bound
    // states the contract the rest of the code relies on, rather than picking a
    // number of decimal places that happens to pass.
    const TOL = 7.5e-8;
    const published: Array<[number, number]> = [
      [0, 0.5],
      [1, 0.8413447461],
      [-1, 0.1586552539],
      [1.959963985, 0.975],
      [2.575829304, 0.995],
      [-3, 0.001349898],
      [-1.959963985, 0.025],
    ];
    for (const [z, expected] of published) {
      expect(Math.abs(normalCdf(z) - expected)).toBeLessThan(TOL);
    }
  });

  it('is symmetric and complementary', () => {
    for (const z of [-2.5, -1, -0.3, 0, 0.7, 1.4, 3.1]) {
      expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 7);
      expect(normalSf(z)).toBeCloseTo(1 - normalCdf(z), 12);
    }
  });

  it('scales with mean and sd', () => {
    expect(normalCdf(110, 100, 10)).toBeCloseTo(normalCdf(1), 9);
    expect(normalPdf(100, 100, 10)).toBeCloseTo(1 / (10 * Math.sqrt(2 * Math.PI)), 12);
  });

  it('inverts the CDF to published critical values', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963985, 6);
    expect(normalQuantile(0.95)).toBeCloseTo(1.644853627, 6);
    expect(normalQuantile(0.995)).toBeCloseTo(2.575829304, 6);
    expect(normalQuantile(0.025)).toBeCloseTo(-1.959963985, 6);
  });

  it('round-trips CDF and quantile', () => {
    for (const p of [0.001, 0.01, 0.2, 0.5, 0.8, 0.99, 0.999]) {
      expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 6);
    }
  });

  it('integrates the pdf to the cdf', () => {
    // Crude midpoint rule, purely as an independent check of consistency.
    const lo = -8;
    const hi = 1.3;
    const n = 200_000;
    const h = (hi - lo) / n;
    let area = 0;
    for (let i = 0; i < n; i++) area += normalPdf(lo + h * (i + 0.5));
    expect(area * h).toBeCloseTo(normalCdf(1.3), 6);
  });
});

describe('ordinary least squares', () => {
  it('recovers an exact line with no noise', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map((x) => 3 * x - 1);
    const fit = olsLine(xs, ys);
    expect(fit.slope).toBeCloseTo(3, 12);
    expect(fit.intercept).toBeCloseTo(-1, 12);
  });

  it('matches the closed-form slope on a hand-checked sample', () => {
    const xs = [1, 2, 3, 4];
    const ys = [2, 4, 5, 9];
    // mx = 2.5, my = 5; dx = [-1.5,-0.5,0.5,1.5], dy = [-3,-1,0,4]
    // Sxy = 4.5 + 0.5 + 0 + 6 = 11, Sxx = 2.25 + 0.25 + 0.25 + 2.25 = 5
    // slope = 11/5 = 2.2, intercept = 5 - 2.2*2.5 = -0.5
    const fit = olsLine(xs, ys);
    expect(fit.slope).toBeCloseTo(2.2, 12);
    expect(fit.intercept).toBeCloseTo(-0.5, 12);
  });

  it('degrades safely on constant x or tiny inputs', () => {
    expect(olsLine([2, 2, 2], [1, 5, 9]).slope).toBe(0);
    expect(olsLine([], []).slope).toBe(0);
    expect(olsLine([1], [7]).intercept).toBe(7);
  });
});
