import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ORDER,
  POPULATION,
  counts,
  iconCategories,
  likelihoodRatioNegative,
  likelihoodRatioPositive,
  negativePredictiveValue,
  oddsToProbability,
  positivePredictiveValue,
  probabilityToOdds,
  solve,
  type BayesInputs,
} from './model';

const base: BayesInputs = {
  prevalence: 0.01,
  sensitivity: 0.99,
  specificity: 0.95,
  tests: 1,
};

describe('Bayes, against worked values', () => {
  // The canonical example. A test that is 99% sensitive and 95% specific,
  // applied to a condition affecting 1 in 100:
  //   0.99*0.01 = 0.0099 true positives
  //   0.05*0.99 = 0.0495 false positives
  //   PPV = 0.0099 / 0.0594 = 1/6
  it('gives 16.7% for the classic 1% prevalence case', () => {
    expect(solve(base).ppv).toBeCloseTo(1 / 6, 10);
  });

  it('matches the direct form of Bayes rule everywhere', () => {
    for (const prevalence of [0.0001, 0.001, 0.02, 0.2, 0.5]) {
      for (const sensitivity of [0.6, 0.9, 0.99]) {
        for (const specificity of [0.6, 0.9, 0.999]) {
          const direct =
            (sensitivity * prevalence) /
            (sensitivity * prevalence + (1 - specificity) * (1 - prevalence));
          expect(positivePredictiveValue(prevalence, sensitivity, specificity)).toBeCloseTo(
            direct,
            12,
          );
        }
      }
    }
  });

  it('reduces to the accuracy when the condition is a coin flip', () => {
    // At prevalence 1/2 with sensitivity = specificity = s, PPV is exactly s.
    for (const s of [0.6, 0.8, 0.99]) {
      expect(positivePredictiveValue(0.5, s, s)).toBeCloseTo(s, 12);
    }
  });

  it('computes the negative predictive value', () => {
    const direct = (0.95 * 0.99) / (0.95 * 0.99 + 0.01 * 0.01);
    expect(negativePredictiveValue(0.01, 0.99, 0.95)).toBeCloseTo(direct, 12);
    // A rare condition plus a sensitive test makes a negative very reassuring.
    expect(solve(base).npv).toBeGreaterThan(0.999);
  });
});

describe('the odds form', () => {
  it('round-trips odds and probabilities', () => {
    for (const p of [0.001, 0.1, 0.5, 0.9, 0.999]) {
      expect(oddsToProbability(probabilityToOdds(p))).toBeCloseTo(p, 12);
    }
  });

  it('computes likelihood ratios', () => {
    expect(likelihoodRatioPositive(0.99, 0.95)).toBeCloseTo(0.99 / 0.05, 12);
    expect(likelihoodRatioNegative(0.99, 0.95)).toBeCloseTo(0.01 / 0.95, 12);
    // A perfect specificity means a positive is conclusive.
    expect(likelihoodRatioPositive(0.9, 1)).toBe(Infinity);
    expect(positivePredictiveValue(0.01, 0.9, 1)).toBe(1);
  });

  it('agrees with the direct form: posterior odds = prior odds x LR', () => {
    const out = solve(base);
    expect(out.posteriorOdds).toBeCloseTo(out.priorOdds * out.likelihoodRatioPositive, 10);
    expect(oddsToProbability(out.posteriorOdds)).toBeCloseTo(out.ppv, 12);
  });

  it('shows the likelihood ratio is a property of the test alone', () => {
    // Same test, three populations: the LR never moves, the answer moves a lot.
    const lrs = [0.0001, 0.01, 0.4].map(
      (prevalence) => solve({ ...base, prevalence }).likelihoodRatioPositive,
    );
    expect(lrs[0]!).toBeCloseTo(lrs[1]!, 12);
    expect(lrs[1]!).toBeCloseTo(lrs[2]!, 12);

    const ppvs = [0.0001, 0.01, 0.4].map((prevalence) => solve({ ...base, prevalence }).ppv);
    expect(ppvs[0]!).toBeLessThan(0.01);
    expect(ppvs[2]!).toBeGreaterThan(0.9);
  });
});

describe('base rates dominate', () => {
  it('leaves a positive result mostly wrong when the condition is rare', () => {
    // Even a 99.9%-specific test is mostly false alarms at 1 in 10,000.
    const out = solve({ prevalence: 0.0001, sensitivity: 0.99, specificity: 0.999, tests: 1 });
    expect(out.ppv).toBeLessThan(0.1);
    expect(out.falsePositive).toBeGreaterThan(out.truePositive);
  });

  it('is fixed by specificity, not by sensitivity', () => {
    const betterSensitivity = solve({ ...base, sensitivity: 1 });
    const betterSpecificity = solve({ ...base, specificity: 0.999 });

    // Perfect sensitivity barely helps; it cannot remove a single false positive.
    expect(betterSensitivity.ppv).toBeLessThan(0.2);
    // Cutting the false positive rate by fifty does almost all the work.
    expect(betterSpecificity.ppv).toBeGreaterThan(0.9);
  });

  it('rises monotonically with prevalence', () => {
    let previous = 0;
    for (const prevalence of [0.0001, 0.001, 0.01, 0.1, 0.3, 0.6]) {
      const ppv = positivePredictiveValue(prevalence, 0.9, 0.9);
      expect(ppv).toBeGreaterThan(previous);
      previous = ppv;
    }
  });

  it('compounds with a second independent positive', () => {
    const once = solve(base);
    const twice = solve({ ...base, tests: 2 });
    expect(twice.posteriorOdds).toBeCloseTo(once.priorOdds * once.likelihoodRatioPositive ** 2, 8);
    // 1/6 after one test becomes near-certainty after two.
    expect(once.ppv).toBeCloseTo(1 / 6, 8);
    expect(twice.ppv).toBeGreaterThan(0.79);
    expect(twice.ppvSingle).toBeCloseTo(once.ppv, 12);
  });
});

describe('the icon array', () => {
  it('accounts for exactly the whole population', () => {
    for (const prevalence of [0.0001, 0.01, 0.13, 0.5]) {
      const c = counts({ ...base, prevalence });
      expect(c.truePositive + c.falseNegative + c.falsePositive + c.trueNegative).toBe(POPULATION);
    }
  });

  it('keeps every count non-negative', () => {
    for (const prevalence of [0, 0.0001, 0.5]) {
      for (const sensitivity of [0.5, 1]) {
        for (const specificity of [0.5, 1]) {
          const c = counts({ prevalence, sensitivity, specificity, tests: 1 });
          for (const v of Object.values(c)) expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('emits one icon per person, grouped by category', () => {
    const icons = iconCategories(base);
    const c = counts(base);
    expect(icons).toHaveLength(POPULATION);

    const tally = [0, 0, 0, 0];
    for (const v of icons) tally[v]! += 1;
    expect(tally[1]).toBe(c.truePositive);
    expect(tally[2]).toBe(c.falseNegative);
    expect(tally[3]).toBe(c.falsePositive);
    expect(tally[0]).toBe(c.trueNegative);
    expect(CATEGORY_ORDER).toHaveLength(4);
  });

  it('shows more false positives than true ones at low prevalence', () => {
    const icons = iconCategories({ ...base, prevalence: 0.001 });
    let truePositives = 0;
    let falsePositives = 0;
    for (const v of icons) {
      if (v === 1) truePositives++;
      if (v === 3) falsePositives++;
    }
    expect(falsePositives).toBeGreaterThan(truePositives * 5);
  });
});
