import { describe, expect, it } from 'vitest';
import {
  Z_95,

  drawCohort,
  kaplanMeier,
  medianOf,
  rateFromMedian,
  censoringRate,
  solve,
  survivalAt,
  trueSurvival,
  type Observation,
  type SurvivalInputs,
} from './model';

const base: SurvivalInputs = {
  n: 120,
  median: 12,
  censoring: 0.35,
  sample: 1,
  comparator: 'none',
};

describe('Kaplan-Meier, worked by hand', () => {
  // Times 1..5, with 2 and 5 censored. Step by step:
  //   t=1  at risk 5, 1 event -> S = 4/5           = 0.8
  //   t=2  censored, no step, but leaves the risk set
  //   t=3  at risk 3, 1 event -> S = 0.8 * 2/3     = 0.5333...
  //   t=4  at risk 2, 1 event -> S = 0.5333 * 1/2  = 0.2666...
  //   t=5  censored, no step
  const observations: Observation[] = [
    { time: 1, event: true },
    { time: 2, event: false },
    { time: 3, event: true },
    { time: 4, event: true },
    { time: 5, event: false },
  ];

  it('produces one step per distinct event time, in order', () => {
    const km = kaplanMeier(observations);
    expect(km.map((s) => s.time)).toEqual([1, 3, 4]);
  });

  it('gets the product-limit values and risk sets right', () => {
    const km = kaplanMeier(observations);
    expect(km[0]!.survival).toBeCloseTo(0.8, 12);
    expect(km[0]!.atRisk).toBe(5);
    expect(km[1]!.survival).toBeCloseTo(0.8 * (2 / 3), 12);
    expect(km[1]!.atRisk).toBe(3); // the censored subject at t=2 has left
    expect(km[2]!.survival).toBeCloseTo(0.8 * (2 / 3) * 0.5, 12);
    expect(km[2]!.atRisk).toBe(2);
  });

  it('matches Greenwood by hand at the first step', () => {
    const km = kaplanMeier(observations);
    // sum = d / (n(n-d)) = 1 / (5*4) = 0.05 ; se = S * sqrt(sum)
    const se = 0.8 * Math.sqrt(0.05);
    expect(km[0]!.lower).toBeCloseTo(Math.max(0, 0.8 - Z_95 * se), 10);
    expect(km[0]!.upper).toBeCloseTo(Math.min(1, 0.8 + Z_95 * se), 10);
  });

  it('handles ties at one time as a single step', () => {
    const tied: Observation[] = [
      { time: 2, event: true },
      { time: 2, event: true },
      { time: 5, event: true },
      { time: 9, event: false },
    ];
    const km = kaplanMeier(tied);
    expect(km.map((s) => s.time)).toEqual([2, 5]);
    expect(km[0]!.events).toBe(2);
    expect(km[0]!.survival).toBeCloseTo(1 - 2 / 4, 12);
  });
});

describe('Kaplan-Meier properties', () => {
  it('reduces to the empirical survival function when nothing is censored', () => {
    const outcome = solve({ ...base, n: 200, censoring: 0 });
    expect(outcome.censoredCount).toBe(0);

    const times = outcome.observations.map((o) => o.time);
    for (const t of [1, 3, 6, 12, 24]) {
      const empirical = times.filter((x) => x > t).length / times.length;
      expect(survivalAt(outcome.km, t)).toBeCloseTo(empirical, 12);
    }
  });

  it('starts at 1, never increases, and stays inside [0, 1]', () => {
    const outcome = solve({ ...base, n: 300, censoring: 0.5, sample: 4 });
    let previous = 1;
    for (const step of outcome.km) {
      expect(step.survival).toBeLessThanOrEqual(previous + 1e-12);
      expect(step.survival).toBeGreaterThanOrEqual(0);
      expect(step.lower).toBeGreaterThanOrEqual(0);
      expect(step.upper).toBeLessThanOrEqual(1);
      expect(step.lower).toBeLessThanOrEqual(step.survival + 1e-12);
      previous = step.survival;
    }
  });

  it('is consistent: with a large cohort it tracks the true curve despite censoring', () => {
    const outcome = solve({ ...base, n: 20_000, censoring: 0.4, sample: 3 });
    for (const t of [4, 8, 12, 18]) {
      expect(survivalAt(outcome.km, t)).toBeCloseTo(trueSurvival(t, 12), 1);
    }
    // And it recovers the true median to within a month.
    expect(outcome.medianEstimate).not.toBeNull();
    expect(Math.abs(outcome.medianEstimate! - 12)).toBeLessThan(1);
  });

  it('censors approximately the requested fraction', () => {
    for (const c of [0, 0.2, 0.5]) {
      const outcome = solve({ ...base, n: 20_000, censoring: c, sample: 5 });
      expect(outcome.censoredCount / 20_000).toBeCloseTo(c, 1);
    }
  });

  it('derives the censoring rate that produces the requested fraction', () => {
    const lambda = rateFromMedian(12);
    for (const c of [0.1, 0.35, 0.6]) {
      const mu = censoringRate(lambda, c);
      // P(C < T) = mu / (lambda + mu) must equal c exactly.
      expect(mu / (lambda + mu)).toBeCloseTo(c, 12);
    }
  });
});

describe('the naive comparators are wrong in opposite directions', () => {
  // Both predictions below are closed-form consequences of exponential event
  // and censoring times; see the header of model.ts.
  const n = 40_000;
  const median = 12;
  const c = 0.4;

  it('discarding censored subjects decays too fast, with median = median*(1-c)', () => {
    const outcome = solve({ n, median, censoring: c, sample: 2, comparator: 'drop' });
    expect(outcome.comparatorMedian).not.toBeNull();
    expect(outcome.comparatorMedian!).toBeCloseTo(median * (1 - c), 0);
    // 7.2 months against a true 12: an underestimate of two fifths.
    expect(outcome.comparatorMedian!).toBeLessThan(median * 0.7);
  });

  it('treating censored subjects as survivors plateaus at the censored fraction', () => {
    const outcome = solve({ n, median, censoring: c, sample: 2, comparator: 'ignore' });
    // S(t) -> c as t grows, so it never reaches zero.
    const tail = outcome.comparator[outcome.comparator.length - 1]!;
    expect(tail.survival).toBeCloseTo(c, 1);

    // Its median solves 1 - (1-c)(1 - exp(-t*lambda/(1-c))) = 0.5, i.e.
    // t = -(1-c)/lambda * ln(1 - 0.5/(1-c)) = 18.6 months for these inputs.
    const lambda = rateFromMedian(median);
    const predicted = (-(1 - c) / lambda) * Math.log(1 - 0.5 / (1 - c));
    expect(predicted).toBeCloseTo(18.6, 0);
    expect(outcome.comparatorMedian).not.toBeNull();
    expect(outcome.comparatorMedian!).toBeCloseTo(predicted, 0);
  });

  it('brackets the truth: drop below, ignore above, Kaplan-Meier between', () => {
    const dropped = solve({ n, median, censoring: c, sample: 6, comparator: 'drop' });
    const ignored = solve({ n, median, censoring: c, sample: 6, comparator: 'ignore' });
    const t = 12;
    const truth = trueSurvival(t, median);

    expect(survivalAt(dropped.comparator, t)).toBeLessThan(truth);
    expect(survivalAt(ignored.comparator, t)).toBeGreaterThan(truth);
    expect(survivalAt(dropped.km, t)).toBeCloseTo(truth, 1);
  });

  it('agrees with Kaplan-Meier when there is nothing to censor', () => {
    const outcome = solve({ n: 400, median, censoring: 0, sample: 8, comparator: 'drop' });
    for (const t of [3, 9, 15]) {
      expect(survivalAt(outcome.comparator, t)).toBeCloseTo(survivalAt(outcome.km, t), 12);
    }
  });
});

describe('reporting', () => {
  it('reports "not reached" rather than inventing a median', () => {
    const short: Observation[] = [
      { time: 1, event: true },
      { time: 2, event: false },
      { time: 3, event: false },
    ];
    // One event out of three leaves the curve at 2/3, never touching 0.5.
    expect(medianOf(kaplanMeier(short))).toBeNull();
  });

  it('is deterministic in its inputs and responsive to the sample index', () => {
    const a = drawCohort(base);
    const b = drawCohort(base);
    const c = drawCohort({ ...base, sample: 2 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
