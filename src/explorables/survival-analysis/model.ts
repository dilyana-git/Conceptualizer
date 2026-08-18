/**
 * Survival analysis — PURE simulation module. SPEC §3.3.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13)
 * ---------------------------------------------------------------------------
 * The cohort is exponential: event times T ~ Exp(lambda), with lambda fixed by
 * the true median, since median = ln(2)/lambda for an exponential.
 *
 * Censoring is independent and also exponential, C ~ Exp(mu). For independent
 * exponentials the probability that censoring comes first is
 *
 *     P(C < T) = mu / (lambda + mu)
 *
 * so a target censoring fraction c is obtained exactly (in expectation) by
 *
 *     mu = lambda * c / (1 - c)
 *
 * which is what makes the censoring slider mean what its label says.
 *
 * The Kaplan-Meier product-limit estimator (Kaplan & Meier, JASA 53, 1958):
 *
 *     S(t) = product over event times t_j <= t of (1 - d_j / n_j)
 *
 * where n_j is the number still at risk just before t_j and d_j the number of
 * events at t_j. Subjects censored at or after t_j are still at risk at t_j.
 *
 * Greenwood's formula for the variance (Greenwood, 1926):
 *
 *     Var(S(t)) = S(t)^2 * sum over t_j <= t of d_j / (n_j (n_j - d_j))
 *
 * The two naive comparators are wrong in opposite directions, which is the
 * point of offering both:
 *
 *   'drop'    discard the censored subjects and take the empirical survival of
 *             the rest. Because T | T < C ~ Exp(lambda + mu), this does not
 *             estimate S at all — it estimates exp(-t*lambda/(1-c)), decaying
 *             too fast, and its median lands at median*(1-c).
 *
 *   'ignore'  keep everyone but count only observed events, so a censored
 *             subject is implicitly treated as never having the event. This
 *             plateaus at the censoring fraction c and never reaches zero:
 *
 *                 S(t) = 1 - (1-c)(1 - exp(-t*lambda/(1-c)))
 *
 * Note that counting every censored observation *as* an event would be a third
 * option, but under exponential censoring min(T,C) ~ Exp(lambda+mu) — exactly
 * the same distribution as 'drop' — so it would draw the same curve and teach
 * nothing extra.
 * ---------------------------------------------------------------------------
 */
import { exponentialFrom, mulberry32, normalQuantile } from '../../lib/stats';

export type Comparator = 'none' | 'drop' | 'ignore';

export interface SurvivalInputs {
  /** Cohort size. */
  n: number;
  /** True median survival, in months. */
  median: number;
  /** Target fraction of the cohort censored, in [0, 1). */
  censoring: number;
  /** Which dataset to draw; changing it redraws the same process. */
  sample: number;
  comparator: Comparator;
}

export interface Observation {
  /** Observed time: min(event, censoring). */
  time: number;
  /** True if the event was observed; false if the subject was censored. */
  event: boolean;
}

export interface StepPoint {
  time: number;
  survival: number;
  /** Number still at risk just before this time. */
  atRisk: number;
  events: number;
  lower: number;
  upper: number;
}

export interface SurvivalOutcome {
  observations: Observation[];
  /** Kaplan-Meier steps, one per distinct event time, in time order. */
  km: StepPoint[];
  /** The selected naive comparator, as a step curve. Empty when 'none'. */
  comparator: StepPoint[];
  /** Times at which subjects were censored, for the tick marks. */
  censoredTimes: number[];
  eventCount: number;
  censoredCount: number;
  /** Kaplan-Meier median, or null when the curve never reaches 0.5. */
  medianEstimate: number | null;
  /** Comparator's median, or null. */
  comparatorMedian: number | null;
  trueMedian: number;
  lambda: number;
  mu: number;
  /** Time axis upper bound, in months. */
  horizon: number;
}

export const Z_95 = normalQuantile(0.975);

export function rateFromMedian(median: number): number {
  return Math.LN2 / median;
}

/** True survival S(t) = exp(-lambda t). */
export function trueSurvival(t: number, median: number): number {
  return Math.exp(-rateFromMedian(median) * t);
}

/** Censoring rate that yields the requested censored fraction in expectation. */
export function censoringRate(lambda: number, censoredFraction: number): number {
  if (censoredFraction <= 0) return 0;
  return (lambda * censoredFraction) / (1 - censoredFraction);
}

/**
 * Draw the cohort. Deterministic in (n, median, censoring, sample): the same
 * parameters always give the same people, so a shared link shows the sharer's
 * exact dataset (§0, §6).
 */
export function drawCohort(inputs: SurvivalInputs): Observation[] {
  const { n, median, censoring, sample } = inputs;
  const lambda = rateFromMedian(median);
  const mu = censoringRate(lambda, censoring);
  // The seed mixes the sample index with the cohort size so that nudging n
  // does not merely append subjects to an otherwise identical dataset.
  const rng = mulberry32(sample * 7919 + n * 104729);

  const out: Observation[] = [];
  for (let i = 0; i < n; i++) {
    const eventTime = exponentialFrom(rng(), lambda);
    const censorTime = mu === 0 ? Infinity : exponentialFrom(rng(), mu);
    out.push(
      eventTime <= censorTime
        ? { time: eventTime, event: true }
        : { time: censorTime, event: false },
    );
  }
  return out.sort((a, b) => a.time - b.time);
}

/**
 * Kaplan-Meier product-limit estimator with Greenwood 95% pointwise limits.
 *
 * The confidence limits are the plain (linear) form, clamped to [0, 1]. See the
 * Limits prose: a complementary log-log transform behaves better in the tails,
 * and is the usual default in statistical software.
 */
export function kaplanMeier(observations: readonly Observation[]): StepPoint[] {
  const steps: StepPoint[] = [];
  let survival = 1;
  let greenwoodSum = 0;
  let index = 0;
  const total = observations.length;

  while (index < total) {
    const time = observations[index]!.time;

    // Everyone with an observed time >= this time is still at risk.
    const atRisk = total - index;

    let events = 0;
    let j = index;
    while (j < total && observations[j]!.time === time) {
      if (observations[j]!.event) events++;
      j++;
    }
    index = j;

    if (events === 0) continue; // a censoring time only removes people from risk

    survival *= 1 - events / atRisk;

    // Greenwood's sum; the term is undefined when a step empties the risk set,
    // which is exactly when the curve hits zero and the variance stops meaning
    // anything. Leaving the sum unchanged keeps the band finite there.
    if (atRisk > events) {
      greenwoodSum += events / (atRisk * (atRisk - events));
    }

    const se = survival * Math.sqrt(greenwoodSum);
    steps.push({
      time,
      survival,
      atRisk,
      events,
      lower: Math.max(0, survival - Z_95 * se),
      upper: Math.min(1, survival + Z_95 * se),
    });
  }

  return steps;
}

/** Empirical survival of a set of times, every one treated as an event. */
function empiricalSurvival(times: readonly number[]): StepPoint[] {
  const sorted = [...times].sort((a, b) => a - b);
  const total = sorted.length;
  const steps: StepPoint[] = [];
  let i = 0;
  while (i < total) {
    const time = sorted[i]!;
    let count = 0;
    while (i < total && sorted[i] === time) {
      count++;
      i++;
    }
    const survival = 1 - i / total;
    steps.push({ time, survival, atRisk: total - (i - count), events: count, lower: survival, upper: survival });
  }
  return steps;
}

export function comparatorCurve(
  observations: readonly Observation[],
  which: Comparator,
): StepPoint[] {
  if (which === 'none') return [];

  if (which === 'drop') {
    // Complete-case: throw the censored subjects away entirely.
    return empiricalSurvival(observations.filter((o) => o.event).map((o) => o.time));
  }

  // 'ignore': keep the whole denominator but count only observed events, so a
  // censored subject silently counts as a survivor forever.
  const total = observations.length;
  const eventTimes = observations.filter((o) => o.event).map((o) => o.time).sort((a, b) => a - b);
  const steps: StepPoint[] = [];
  let i = 0;
  while (i < eventTimes.length) {
    const time = eventTimes[i]!;
    let count = 0;
    while (i < eventTimes.length && eventTimes[i] === time) {
      count++;
      i++;
    }
    const survival = 1 - i / total;
    steps.push({ time, survival, atRisk: total, events: count, lower: survival, upper: survival });
  }
  return steps;
}

/** First time at which a step curve is at or below 0.5, or null if never. */
export function medianOf(steps: readonly StepPoint[]): number | null {
  for (const step of steps) {
    if (step.survival <= 0.5) return step.time;
  }
  return null;
}

/** A round time axis that changes in whole years, so it does not twitch. */
export function horizonFor(median: number): number {
  return Math.max(12, Math.ceil((median * 2.5) / 12) * 12);
}

export function solve(inputs: SurvivalInputs): SurvivalOutcome {
  const observations = drawCohort(inputs);
  const km = kaplanMeier(observations);
  const comparator = comparatorCurve(observations, inputs.comparator);
  const lambda = rateFromMedian(inputs.median);

  return {
    observations,
    km,
    comparator,
    censoredTimes: observations.filter((o) => !o.event).map((o) => o.time),
    eventCount: observations.filter((o) => o.event).length,
    censoredCount: observations.filter((o) => !o.event).length,
    medianEstimate: medianOf(km),
    comparatorMedian: medianOf(comparator),
    trueMedian: inputs.median,
    lambda,
    mu: censoringRate(lambda, inputs.censoring),
    horizon: horizonFor(inputs.median),
  };
}

/**
 * Turn a step curve into polyline vertices: start at (0, 1), run flat to each
 * event time, then drop. Rendering geometry, but it is a statement about what
 * the estimator asserts between observations, so it lives with the model.
 */
export function polylinePoints(
  steps: readonly StepPoint[],
  horizon: number,
): { t: number; s: number }[] {
  const points: { t: number; s: number }[] = [{ t: 0, s: 1 }];
  let last = 1;
  for (const step of steps) {
    if (step.time > horizon) break;
    points.push({ t: step.time, s: last });
    points.push({ t: step.time, s: step.survival });
    last = step.survival;
  }
  points.push({ t: horizon, s: last });
  return points;
}

/** Survival asserted by a step curve at an arbitrary time. */
export function survivalAt(steps: readonly StepPoint[], t: number): number {
  let s = 1;
  for (const step of steps) {
    if (step.time > t) break;
    s = step.survival;
  }
  return s;
}

const months = (v: number | null) => (v === null ? 'not reached' : `${v.toFixed(1)} mo`);

/** §9: what the chart currently shows, for the aria-live region. */
export function describe(inputs: SurvivalInputs, outcome: SurvivalOutcome): string {
  const pct = Math.round((outcome.censoredCount / Math.max(1, inputs.n)) * 100);
  const base =
    `A cohort of ${inputs.n}. ${outcome.eventCount} had the event and ` +
    `${outcome.censoredCount} were censored, ${pct}%. ` +
    `True median survival is ${inputs.median} months; ` +
    `Kaplan-Meier estimates ${months(outcome.medianEstimate)}.`;

  if (inputs.comparator === 'none') return base;

  const label =
    inputs.comparator === 'drop'
      ? 'Discarding the censored subjects'
      : 'Counting censored subjects as survivors';
  return `${base} ${label} estimates ${months(outcome.comparatorMedian)} instead.`;
}
