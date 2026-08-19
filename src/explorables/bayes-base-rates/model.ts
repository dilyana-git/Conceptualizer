/**
 * Base rates and the predictive value of a test — PURE module. SPEC §3.3.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13)
 * ---------------------------------------------------------------------------
 * Bayes' rule, written in the form that makes the base rate visible:
 *
 *     PPV = P(D | +) = sens*prev / ( sens*prev + (1-spec)*(1-prev) )
 *     NPV = P(!D | -) = spec*(1-prev) / ( spec*(1-prev) + (1-sens)*prev )
 *
 * The odds form is the one worth remembering, because it separates what the
 * test contributes from what the population contributes:
 *
 *     posterior odds = prior odds x LR+,     LR+ = sens / (1 - spec)
 *     posterior odds = prior odds x LR-,     LR- = (1 - sens) / spec
 *
 * A test has one likelihood ratio; the prior odds are entirely a property of
 * who is being tested. That is why an excellent test applied to a rare
 * condition still yields mostly false positives: multiplying very small odds by
 * a large factor leaves small odds.
 *
 * Repeat testing assumes conditional independence given disease status, so k
 * consecutive positives multiply the likelihood ratio k times:
 *
 *     posterior odds = prior odds x LR+^k
 *
 * That assumption is usually optimistic in practice — see the Limits prose.
 * ---------------------------------------------------------------------------
 */

/** Icon-array population. Fixed: it is a display device, not a parameter. */
export const POPULATION = 10_000;

export interface BayesInputs {
  /** Prior probability of the condition in the population being tested. */
  prevalence: number;
  /** P(positive | condition). */
  sensitivity: number;
  /** P(negative | no condition). */
  specificity: number;
  /** How many consecutive independent positives are being conditioned on. */
  tests: number;
}

export interface BayesOutcome {
  /** P(condition | all tests positive). */
  ppv: number;
  /** P(no condition | a single negative). */
  npv: number;
  /** PPV after a single positive, regardless of the `tests` setting. */
  ppvSingle: number;
  likelihoodRatioPositive: number;
  likelihoodRatioNegative: number;
  priorOdds: number;
  posteriorOdds: number;
  /** Whole-person counts out of POPULATION, for the icon array. */
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
  /** Everyone who tests positive. */
  positives: number;
}

export function likelihoodRatioPositive(sensitivity: number, specificity: number): number {
  const fpr = 1 - specificity;
  return fpr === 0 ? Infinity : sensitivity / fpr;
}

export function likelihoodRatioNegative(sensitivity: number, specificity: number): number {
  return specificity === 0 ? Infinity : (1 - sensitivity) / specificity;
}

export function oddsToProbability(odds: number): number {
  if (!Number.isFinite(odds)) return 1;
  return odds / (1 + odds);
}

export function probabilityToOdds(p: number): number {
  return p >= 1 ? Infinity : p / (1 - p);
}

/** P(condition | k consecutive positives), by the odds form of Bayes' rule. */
export function positivePredictiveValue(
  prevalence: number,
  sensitivity: number,
  specificity: number,
  tests = 1,
): number {
  const prior = probabilityToOdds(prevalence);
  const lr = likelihoodRatioPositive(sensitivity, specificity);
  if (!Number.isFinite(lr)) return prevalence > 0 ? 1 : 0;
  return oddsToProbability(prior * Math.pow(lr, tests));
}

/** P(no condition | one negative). */
export function negativePredictiveValue(
  prevalence: number,
  sensitivity: number,
  specificity: number,
): number {
  const healthy = specificity * (1 - prevalence);
  const missed = (1 - sensitivity) * prevalence;
  const total = healthy + missed;
  return total === 0 ? 1 : healthy / total;
}

/**
 * Whole-person counts for the icon array.
 *
 * Rounded so the four categories sum to exactly POPULATION — an array that is
 * short or long by three dots is a visible lie about the arithmetic. The
 * remainder is absorbed by the true negatives, which is always the largest
 * group by a wide margin at the prevalences this explorable is about.
 */
export function counts(inputs: BayesInputs) {
  const { prevalence, sensitivity, specificity } = inputs;
  const withCondition = Math.round(POPULATION * prevalence);
  const withoutCondition = POPULATION - withCondition;

  const truePositive = Math.round(withCondition * sensitivity);
  const falseNegative = withCondition - truePositive;
  const falsePositive = Math.round(withoutCondition * (1 - specificity));
  const trueNegative = withoutCondition - falsePositive;

  return { truePositive, falseNegative, falsePositive, trueNegative };
}

export function solve(inputs: BayesInputs): BayesOutcome {
  const { prevalence, sensitivity, specificity, tests } = inputs;
  const { truePositive, falseNegative, falsePositive, trueNegative } = counts(inputs);

  const lrPos = likelihoodRatioPositive(sensitivity, specificity);
  const prior = probabilityToOdds(prevalence);

  return {
    ppv: positivePredictiveValue(prevalence, sensitivity, specificity, tests),
    ppvSingle: positivePredictiveValue(prevalence, sensitivity, specificity, 1),
    npv: negativePredictiveValue(prevalence, sensitivity, specificity),
    likelihoodRatioPositive: lrPos,
    likelihoodRatioNegative: likelihoodRatioNegative(sensitivity, specificity),
    priorOdds: prior,
    posteriorOdds: Number.isFinite(lrPos) ? prior * Math.pow(lrPos, tests) : Infinity,
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    positives: truePositive + falsePositive,
  };
}

export type Category = 'truePositive' | 'falsePositive' | 'falseNegative' | 'trueNegative';

/**
 * Category for each of the POPULATION icons, in a fixed order that keeps like
 * with like. Ordering rather than scattering is deliberate: a reader is asked
 * to compare two areas, and randomly interleaved dots make that impossible.
 */
export function iconCategories(inputs: BayesInputs): Uint8Array {
  const { truePositive, falseNegative, falsePositive } = counts(inputs);
  const out = new Uint8Array(POPULATION); // 0 = trueNegative, filling the tail
  let i = 0;
  // The two positive groups are laid down adjacently, because the comparison
  // the reader is being asked to make is between exactly those two areas.
  for (let k = 0; k < truePositive; k++) out[i++] = 1;
  for (let k = 0; k < falsePositive; k++) out[i++] = 3;
  for (let k = 0; k < falseNegative; k++) out[i++] = 2;
  return out;
}

/** Icon codes, by their value in `iconCategories`. */
export const CATEGORY_ORDER: Category[] = [
  'trueNegative', // 0
  'truePositive', // 1
  'falseNegative', // 2
  'falsePositive', // 3
];

const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

/** §9: what the array currently shows. */
export function describe(inputs: BayesInputs, outcome: BayesOutcome): string {
  const testWord = inputs.tests === 1 ? 'one positive test' : `${inputs.tests} positive tests`;
  return (
    `Out of ${POPULATION.toLocaleString('en-US')} people tested, ` +
    `${outcome.truePositive.toLocaleString('en-US')} have the condition and test positive, ` +
    `${outcome.falsePositive.toLocaleString('en-US')} do not have it and test positive anyway, ` +
    `and ${outcome.falseNegative.toLocaleString('en-US')} have it but test negative. ` +
    `After ${testWord}, the chance of actually having the condition is ${pct(outcome.ppv)}. ` +
    `A negative result rules it out with ${pct(outcome.npv)} confidence.`
  );
}
