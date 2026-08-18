import { describe, expect, it } from 'vitest';
import { olsLine } from '../../lib/stats';
import {
  GROUP_WIDTH,
  N_PER_GROUP,
  generate,
  groupIndexVariance,
  predictPooledSlope,
  solve,
  withinVarianceX,
  type SimpsonInputs,
} from './model';

const base: SimpsonInputs = {
  groups: 3,
  separation: 2,
  shift: -2.2,
  within: 1,
  noise: 0.4,
  sample: 1,
};

const noiseless = { ...base, noise: 0 };

describe('the variance decomposition', () => {
  it('matches the measured within-group variance of x', () => {
    const points = generate(noiseless).filter((p) => p.group === 0);
    const xs = points.map((p) => p.x);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const measured = xs.reduce((a, x) => a + (x - mx) ** 2, 0) / xs.length;
    // The closed form uses the population variance of evenly spaced points.
    expect(withinVarianceX()).toBeCloseTo(measured, 12);
  });

  it('matches the variance of a uniform group index', () => {
    for (const k of [2, 3, 4, 5]) {
      const gs = Array.from({ length: k }, (_, i) => i);
      const mg = gs.reduce((a, b) => a + b, 0) / k;
      const measured = gs.reduce((a, g) => a + (g - mg) ** 2, 0) / k;
      expect(groupIndexVariance(k)).toBeCloseTo(measured, 12);
    }
  });
});

describe('pooled slope against its closed form', () => {
  it('reproduces the predicted slope exactly when there is no noise', () => {
    const cases: SimpsonInputs[] = [
      noiseless,
      { ...noiseless, groups: 2, separation: 1.5, shift: -1.8, within: 0.6 },
      { ...noiseless, groups: 5, separation: 3, shift: -4, within: 2 },
      { ...noiseless, groups: 4, separation: 0.5, shift: 1, within: -0.5 },
      { ...noiseless, groups: 3, separation: 2.5, shift: 0, within: 1.4 },
    ];
    for (const inputs of cases) {
      const out = solve(inputs);
      expect(out.pooled.slope).toBeCloseTo(predictPooledSlope(inputs), 10);
    }
  });

  it('recovers the within-group slope exactly inside every group', () => {
    const out = solve({ ...noiseless, within: 1.3 });
    for (const line of out.withinLines) {
      expect(line.slope).toBeCloseTo(1.3, 10);
    }
    expect(out.meanWithinSlope).toBeCloseTo(1.3, 10);
  });

  it('attenuates rather than reverses when the groups are not offset', () => {
    // shift = 0 removes the between-group covariance from the numerator but
    // NOT the between-group variance from the denominator, so pooling flattens
    // the slope toward zero without changing its sign. This is the ordinary
    // aggregation attenuation that Simpson's paradox is the extreme case of.
    const out = solve({ ...noiseless, shift: 0, within: 0.9 });
    expect(out.pooled.slope).toBeGreaterThan(0);
    expect(out.pooled.slope).toBeLessThan(0.9);
    expect(out.reversed).toBe(false);
  });

  it('collapses to the within-group slope with a single group', () => {
    const out = solve({ ...noiseless, groups: 1, within: 0.75 });
    expect(groupIndexVariance(1)).toBeCloseTo(0, 12);
    expect(out.pooled.slope).toBeCloseTo(0.75, 10);
  });

  it('attenuates further the wider apart the unoffset groups are', () => {
    const near = solve({ ...noiseless, shift: 0, separation: 0.5 }).pooled.slope;
    const far = solve({ ...noiseless, shift: 0, separation: 4 }).pooled.slope;
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(near);
    expect(near).toBeLessThan(noiseless.within);
  });
});

describe('the reversal itself', () => {
  it('flips the sign at the default settings', () => {
    const out = solve(base);
    expect(out.meanWithinSlope).toBeGreaterThan(0.5);
    expect(out.pooled.slope).toBeLessThan(-0.5);
    expect(out.reversed).toBe(true);
  });

  it('predicts the flipped slope to two decimals', () => {
    // within = +1, but the between-group term dominates:
    //   sx^2 = 1.6^2 * 31 / (12*29) = 0.2280 ; vg = (9-1)/12 = 0.6667
    //   pooled = (1*0.2280 + 2*(-2.2)*0.6667) / (0.2280 + 4*0.6667) = -0.935
    expect(predictPooledSlope(base)).toBeCloseTo(-0.935, 2);
  });

  it('needs both separation and offset: neither alone reverses anything', () => {
    expect(solve({ ...noiseless, separation: 0 }).reversed).toBe(false);
    expect(solve({ ...noiseless, shift: 0 }).reversed).toBe(false);
  });

  it('reverses most strongly at an intermediate separation, not the largest', () => {
    // The obvious guess — further apart means a harder reversal — is wrong.
    // Separation adds sep^2*vg to the denominator but only sep*shift*vg to the
    // numerator, so past a point the reversal weakens again.
    const at = (separation: number) => predictPooledSlope({ ...noiseless, separation });

    expect(at(0.05)).toBeGreaterThan(0); // barely separated: no reversal at all
    expect(at(0.86)).toBeLessThan(at(0.2)); // deepening
    expect(at(0.86)).toBeLessThan(at(3)); // and then easing off again
    expect(at(0.86)).toBeCloseTo(-1.433, 2); // the minimum, to three decimals
  });

  it('approaches shift/separation once the groups are far apart', () => {
    const separation = 12;
    expect(predictPooledSlope({ ...noiseless, separation })).toBeCloseTo(
      noiseless.shift / separation,
      2,
    );
  });

  it('stops reversing once the offset points the same way as the within slope', () => {
    const out = solve({ ...noiseless, shift: 2 });
    expect(out.pooled.slope).toBeGreaterThan(0);
    expect(out.reversed).toBe(false);
  });
});

describe('generation', () => {
  it('is deterministic in its inputs, and responds to the sample index', () => {
    expect(generate(base)).toEqual(generate(base));
    expect(generate(base)).not.toEqual(generate({ ...base, sample: 2 }));
  });

  it('produces balanced groups spanning the intended width', () => {
    const points = generate(base);
    expect(points).toHaveLength(3 * N_PER_GROUP);
    for (let g = 0; g < 3; g++) {
      const xs = points.filter((p) => p.group === g).map((p) => p.x);
      expect(xs).toHaveLength(N_PER_GROUP);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(GROUP_WIDTH, 10);
    }
  });

  it('survives noise: the pooled fit stays near its noise-free prediction', () => {
    const out = solve({ ...base, noise: 0.6, sample: 9 });
    expect(out.pooled.slope).toBeCloseTo(predictPooledSlope(base), 1);
    // Fitting each group separately still recovers a positive slope.
    expect(out.meanWithinSlope).toBeGreaterThan(0);
  });

  it('agrees with a direct fit over all the points', () => {
    const out = solve(base);
    const direct = olsLine(out.points.map((p) => p.x), out.points.map((p) => p.y));
    expect(out.pooled.slope).toBeCloseTo(direct.slope, 12);
    expect(out.pooled.intercept).toBeCloseTo(direct.intercept, 12);
  });
});
