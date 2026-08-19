import { describe, expect, it } from 'vitest';
import { mulberry32, normalSampler } from '../../lib/stats';
import {
  PARENTS,
  drawMeans,
  histogram,
  moments,
  solve,
  type CltInputs,
  type ParentKey,
} from './model';

const base: CltInputs = {
  parent: 'exponential',
  sampleSize: 5,
  draws: 2000,
  bins: 30,
  sample: 1,
};

const ALL: ParentKey[] = ['uniform', 'exponential', 'bimodal', 'lognormal'];

/** Draw raw observations from a parent, bypassing the averaging. */
function drawParent(key: ParentKey, count: number, seed = 99): Float64Array {
  const parent = PARENTS[key];
  const rng = mulberry32(seed);
  const normal = normalSampler(rng);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i++) out[i] = parent.draw(rng, normal);
  return out;
}

describe('the parent distributions match their declared moments', () => {
  it.each(ALL)('%s samples with the stated mean, sd and skewness', (key) => {
    const parent = PARENTS[key];
    const xs = drawParent(key, 400_000);
    const m = moments(xs);

    // Tolerances are sampling standard errors, scaled for heavy tails.
    const seMean = parent.sd / Math.sqrt(xs.length);
    expect(Math.abs(m.mean - parent.mean)).toBeLessThan(6 * seMean);
    expect(m.sd).toBeCloseTo(parent.sd, 1);
    expect(Math.abs(m.skewness - parent.skewness)).toBeLessThan(
      0.15 * Math.max(1, parent.skewness),
    );
  });

  it('has the closed-form moments written down correctly', () => {
    expect(PARENTS.uniform.sd).toBeCloseTo(Math.sqrt(1 / 12), 12);
    expect(PARENTS.exponential.skewness).toBe(2);
    expect(PARENTS.lognormal.mean).toBeCloseTo(Math.exp(0.5), 12);
    expect(PARENTS.lognormal.sd).toBeCloseTo(Math.sqrt((Math.E - 1) * Math.E), 12);
    // Lognormal(0,1) skewness is about 6.185 — three times the exponential's.
    expect(PARENTS.lognormal.skewness).toBeCloseTo(6.1849, 3);
  });

  it('integrates each density to one', () => {
    // Integrated over the full support, not the plotting domain: `domain` is a
    // sensible window to draw, and for the exponential it deliberately cuts off
    // a tail worth about e^-5 of the mass.
    const support: Record<ParentKey, [number, number]> = {
      uniform: [-1, 2],
      exponential: [0, 200],
      bimodal: [-3, 4],
      lognormal: [0, 400],
    };
    for (const key of ALL) {
      const [lo, hi] = support[key];
      const n = 2_000_000;
      const h = (hi - lo) / n;
      let area = 0;
      for (let i = 0; i < n; i++) area += PARENTS[key].pdf(lo + h * (i + 0.5));
      expect(area * h).toBeCloseTo(1, 3);
    }
  });
});

describe('the central limit theorem', () => {
  it('centres the sample means on the parent mean', () => {
    for (const key of ALL) {
      const outcome = solve({ ...base, parent: key, draws: 20_000, sampleSize: 10 });
      const se = outcome.predictedSd / Math.sqrt(20_000);
      expect(Math.abs(outcome.observedMean - PARENTS[key].mean)).toBeLessThan(6 * se);
    }
  });

  it('shrinks the spread as sigma / sqrt(n) — the variance claim', () => {
    for (const sampleSize of [1, 4, 9, 25, 50]) {
      const outcome = solve({ ...base, parent: 'exponential', sampleSize, draws: 30_000 });
      expect(outcome.predictedSd).toBeCloseTo(1 / Math.sqrt(sampleSize), 12);
      // Observed within 4% of predicted at this many draws.
      expect(outcome.observedSd / outcome.predictedSd).toBeCloseTo(1, 1);
    }
  });

  it('halves the spread when the sample size quadruples, not when it doubles', () => {
    const at9 = solve({ ...base, sampleSize: 9, draws: 30_000 });
    const at36 = solve({ ...base, sampleSize: 36, draws: 30_000 });
    expect(at9.predictedSd / at36.predictedSd).toBeCloseTo(2, 12);
    expect(at9.observedSd / at36.observedSd).toBeCloseTo(2, 0);
  });

  it('kills skewness at rate skew / sqrt(n) — the convergence claim', () => {
    // Exponential parent has skewness exactly 2, so the mean of n has 2/sqrt(n).
    for (const sampleSize of [1, 4, 16, 64]) {
      const outcome = solve({ parent: 'exponential', sampleSize, draws: 60_000, bins: 30, sample: 3 });
      expect(outcome.predictedSkew).toBeCloseTo(2 / Math.sqrt(sampleSize), 12);
      expect(outcome.observedSkew).toBeCloseTo(outcome.predictedSkew, 1);
    }
  });

  it('converges more slowly the more skewed the parent is', () => {
    // The lognormal's skewness is about three times the exponential's, so at the
    // same sample size its means are still visibly more lopsided.
    const exponential = solve({ ...base, parent: 'exponential', sampleSize: 20, draws: 40_000 });
    const lognormal = solve({ ...base, parent: 'lognormal', sampleSize: 20, draws: 40_000 });
    expect(Math.abs(lognormal.predictedSkew)).toBeGreaterThan(
      Math.abs(exponential.predictedSkew) * 2.5,
    );
    expect(Math.abs(lognormal.observedSkew)).toBeGreaterThan(Math.abs(exponential.observedSkew));
  });

  it('reproduces the parent exactly at a sample size of one', () => {
    for (const key of ALL) {
      const outcome = solve({ ...base, parent: key, sampleSize: 1, draws: 40_000 });
      expect(outcome.predictedSd).toBeCloseTo(PARENTS[key].sd, 12);
      expect(outcome.predictedSkew).toBeCloseTo(PARENTS[key].skewness, 12);
    }
  });

  it('normalises even a parent with two separated humps', () => {
    // The striking case: the parent has no mass near its own mean at all.
    const single = solve({ ...base, parent: 'bimodal', sampleSize: 1, draws: 20_000, bins: 40 });
    const averaged = solve({ ...base, parent: 'bimodal', sampleSize: 30, draws: 20_000, bins: 40 });

    // Share of draws landing in the central tenth of the plotted window. Raw
    // bin counts are not comparable across the two, because each window is
    // scaled to its own predicted spread.
    const middleShare = (o: typeof single) => {
      const lo = Math.round(o.bins.length * 0.45);
      const hi = Math.round(o.bins.length * 0.55);
      const inside = o.bins.slice(lo, hi).reduce((sum, b) => sum + b.count, 0);
      return inside / o.means.length;
    };

    // A single draw almost never lands between the humps; the mean of thirty
    // lands there more often than anywhere else.
    expect(middleShare(single)).toBeLessThan(0.02);
    expect(middleShare(averaged)).toBeGreaterThan(0.2);
    expect(Math.abs(averaged.observedSkew)).toBeLessThan(0.2);
  });
});

describe('histogram bookkeeping', () => {
  it('accounts for every draw, including values outside the window', () => {
    const outcome = solve({ ...base, draws: 5000, bins: 25 });
    const total = outcome.bins.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(5000);
  });

  it('produces contiguous bins spanning the domain', () => {
    const outcome = solve({ ...base, bins: 12 });
    expect(outcome.bins).toHaveLength(12);
    expect(outcome.bins[0]!.from).toBeCloseTo(outcome.domain[0], 12);
    expect(outcome.bins[11]!.to).toBeCloseTo(outcome.domain[1], 12);
    for (let i = 1; i < outcome.bins.length; i++) {
      expect(outcome.bins[i]!.from).toBeCloseTo(outcome.bins[i - 1]!.to, 12);
    }
  });

  it('produces densities that integrate to one', () => {
    const outcome = solve({ ...base, draws: 8000, bins: 40 });
    const width = outcome.bins[0]!.to - outcome.bins[0]!.from;
    const area = outcome.bins.reduce((sum, b) => sum + b.density * width, 0);
    expect(area).toBeCloseTo(1, 12);
  });

  it('handles an empty sample without dividing by zero', () => {
    const bins = histogram(new Float64Array(0), [0, 1], 10);
    expect(bins.every((b) => b.count === 0 && b.density === 0)).toBe(true);
  });
});

describe('determinism', () => {
  it('redraws identically for the same inputs and differently for a new sample', () => {
    expect(Array.from(drawMeans(base))).toEqual(Array.from(drawMeans(base)));
    expect(Array.from(drawMeans(base))).not.toEqual(Array.from(drawMeans({ ...base, sample: 2 })));
  });
});
