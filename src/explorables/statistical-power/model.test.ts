import { describe, expect, it } from 'vitest';
import { normalPdf } from '../../lib/stats';
import {
  altDensity,
  criticalZFor,
  nullDensity,
  powerFor,
  sampleSizeFor80,
  solve,
  standardError,
  type PowerInputs,
} from './model';

const base: PowerInputs = { effect: 0.5, n: 64, alpha: 0.05, tails: 'two' };

describe('power, against textbook values', () => {
  // The canonical worked example: detecting a medium effect (d = 0.5) at
  // alpha = 0.05 two-tailed with 80% power needs about 64 per group.
  it('reproduces the d=0.5, n=64 -> 80% power benchmark', () => {
    const out = solve(base);
    expect(out.power).toBeGreaterThan(0.79);
    expect(out.power).toBeLessThan(0.82);
  });

  it('inverts to the same benchmark sample size', () => {
    // Normal approximation gives 63 against the t-based textbook 64.
    const n = sampleSizeFor80(0.5, 0.05, 'two');
    expect(n).toBe(63);
    // And the returned n is the *smallest* one that clears 80%.
    expect(powerFor(0.5, n, 0.05, 'two')).toBeGreaterThanOrEqual(0.8);
    expect(powerFor(0.5, n - 1, 0.05, 'two')).toBeLessThan(0.8);
  });

  it('uses the right critical values', () => {
    expect(criticalZFor(0.05, 'two')).toBeCloseTo(1.959963985, 6);
    expect(criticalZFor(0.05, 'one')).toBeCloseTo(1.644853627, 6);
    expect(criticalZFor(0.01, 'two')).toBeCloseTo(2.575829304, 6);
  });

  it('gives standard error sqrt(2/n)', () => {
    expect(standardError(2)).toBeCloseTo(1, 12);
    expect(standardError(50)).toBeCloseTo(Math.sqrt(0.04), 12);
  });
});

describe('power identities', () => {
  // The defining property: with no effect, the rejection rate IS alpha.
  it('equals alpha exactly when the true effect is zero', () => {
    for (const alpha of [0.001, 0.01, 0.05, 0.1, 0.2]) {
      expect(powerFor(0, 100, alpha, 'two')).toBeCloseTo(alpha, 6);
      expect(powerFor(0, 100, alpha, 'one')).toBeCloseTo(alpha, 6);
    }
  });

  it('increases with sample size and with effect size', () => {
    let previous = 0;
    for (const n of [5, 10, 25, 50, 100, 400]) {
      const p = powerFor(0.4, n, 0.05, 'two');
      expect(p).toBeGreaterThan(previous);
      previous = p;
    }
    previous = 0;
    for (const d of [0.05, 0.1, 0.3, 0.6, 1.0]) {
      const p = powerFor(d, 40, 0.05, 'two');
      expect(p).toBeGreaterThan(previous);
      previous = p;
    }
  });

  it('is higher one-tailed than two-tailed for an effect in the predicted direction', () => {
    expect(powerFor(0.4, 40, 0.05, 'one')).toBeGreaterThan(powerFor(0.4, 40, 0.05, 'two'));
  });

  it('increases with a laxer alpha', () => {
    expect(powerFor(0.3, 40, 0.1, 'two')).toBeGreaterThan(powerFor(0.3, 40, 0.01, 'two'));
  });

  it('stays a probability across the whole parameter range', () => {
    for (const d of [0, 0.25, 0.75, 1.2]) {
      for (const n of [5, 60, 500]) {
        for (const alpha of [0.001, 0.05, 0.2]) {
          for (const tails of ['one', 'two'] as const) {
            const p = powerFor(d, n, alpha, tails);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('Type S and Type M errors', () => {
  it('exaggerates most when power is lowest', () => {
    const weak = solve({ effect: 0.1, n: 20, alpha: 0.05, tails: 'two' });
    const strong = solve({ effect: 0.8, n: 200, alpha: 0.05, tails: 'two' });

    expect(weak.power).toBeLessThan(0.15);
    expect(weak.typeM).toBeGreaterThan(3);
    expect(strong.power).toBeGreaterThan(0.99);
    expect(strong.typeM).toBeLessThan(1.02);
  });

  it('never understates: the exaggeration ratio is at least 1', () => {
    for (const d of [0.05, 0.2, 0.5, 1.0]) {
      for (const n of [5, 30, 150, 500]) {
        expect(solve({ effect: d, n, alpha: 0.05, tails: 'two' }).typeM).toBeGreaterThanOrEqual(
          0.999,
        );
      }
    }
  });

  it('gets the sign wrong a meaningful share of the time when power is tiny', () => {
    const dire = solve({ effect: 0.05, n: 10, alpha: 0.05, tails: 'two' });
    expect(dire.power).toBeLessThan(0.07);
    expect(dire.typeS).toBeGreaterThan(0.2);

    const fine = solve({ effect: 0.8, n: 100, alpha: 0.05, tails: 'two' });
    expect(fine.typeS).toBeLessThan(1e-6);
  });

  it('reports no sign error for a one-tailed test, which cannot make one', () => {
    expect(solve({ effect: 0.1, n: 10, alpha: 0.05, tails: 'one' }).typeS).toBe(0);
  });

  it('matches a direct numeric integration of the exaggeration ratio', () => {
    const inputs: PowerInputs = { effect: 0.3, n: 25, alpha: 0.05, tails: 'two' };
    const out = solve(inputs);

    // Integrate E[|Z| . 1{|Z|>c}] over Z ~ N(ncp, 1). Each rejection tail is
    // integrated from its exact endpoint rather than sweeping one grid across
    // the whole line: the indicator is discontinuous at +/-c, and a grid that
    // straddles that cut carries an O(h) boundary error which swamps the
    // quantity being checked.
    const c = out.criticalZ;
    const tail = (from: number, to: number) => {
      const steps = 200_000;
      const h = (to - from) / steps;
      let magnitude = 0;
      let mass = 0;
      for (let i = 0; i < steps; i++) {
        const z = from + h * (i + 0.5);
        const w = normalPdf(z, out.ncp, 1) * h;
        magnitude += Math.abs(z) * w;
        mass += w;
      }
      return { magnitude, mass };
    };

    const upper = tail(c, out.ncp + 14);
    const lower = tail(out.ncp - 14, -c);
    const mass = upper.mass + lower.mass;
    const magnitude = upper.magnitude + lower.magnitude;

    expect(mass).toBeCloseTo(out.power, 6);
    // The closed form divides by power (~0.19 here), which amplifies the
    // normal CDF's own ~7.5e-8 error to a few parts in 10^7. Five decimals is
    // what the underlying numerics actually support.
    expect(magnitude / mass / out.ncp).toBeCloseTo(out.typeM, 5);
  });
});

describe('densities', () => {
  it('places the null at zero and the alternative at the true effect', () => {
    const se = standardError(50);
    expect(nullDensity(0, se)).toBeGreaterThan(nullDensity(0.2, se));
    expect(altDensity(0.4, 0.4, se)).toBeGreaterThan(altDensity(0.1, 0.4, se));
    // Both are the same shape, only shifted.
    expect(altDensity(0.4 + 0.13, 0.4, se)).toBeCloseTo(nullDensity(0.13, se), 12);
  });

  it('narrows as the sample grows', () => {
    expect(nullDensity(0, standardError(400))).toBeGreaterThan(nullDensity(0, standardError(25)));
  });
});
