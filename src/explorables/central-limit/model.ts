/**
 * The central limit theorem — PURE module. SPEC §3.3.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13)
 * ---------------------------------------------------------------------------
 * For i.i.d. draws with finite mean mu and variance sigma^2, the sample mean of
 * n of them has
 *
 *     E[Xbar] = mu                 Var[Xbar] = sigma^2 / n
 *     skew[Xbar] = skew[X] / sqrt(n)
 *
 * and its distribution tends to normal as n grows. The third identity is the
 * useful one for an explorable, because it says *how fast* — convergence is
 * governed by the parent's own skewness divided by sqrt(n), so a parent with
 * skewness 6 needs about nine times the sample size of one with skewness 2 to
 * look equally normal. That is why the lognormal parent here still looks
 * visibly lopsided at sample sizes where the uniform is already indistinguishable
 * from a bell.
 *
 * Parent distributions, with their closed-form moments:
 *
 *   uniform(0,1)        mu = 1/2,        sigma^2 = 1/12,       skew = 0
 *   exponential(1)      mu = 1,          sigma^2 = 1,          skew = 2
 *   bimodal             equal mixture of N(0, 0.1) and N(1, 0.1):
 *                       mu = 1/2,        sigma^2 = 0.26,       skew = 0
 *   lognormal(0,1)      mu = e^(1/2),    sigma^2 = (e-1)e,     skew = (e+2)sqrt(e-1)
 * ---------------------------------------------------------------------------
 */
import { mulberry32, normalPdf, normalSampler } from '../../lib/stats';

export type ParentKey = 'uniform' | 'exponential' | 'bimodal' | 'lognormal';

export interface Parent {
  key: ParentKey;
  label: string;
  mean: number;
  sd: number;
  skewness: number;
  /** Density, for drawing the parent curve. */
  pdf: (x: number) => number;
  /** Sensible plotting range for the parent. */
  domain: readonly [number, number];
  draw: (uniform: () => number, normal: () => number) => number;
}

const BIMODAL_SPREAD = 0.1;
const LOGNORMAL_SIGMA = 1;

const E = Math.E;

export const PARENTS: Record<ParentKey, Parent> = {
  uniform: {
    key: 'uniform',
    label: 'Uniform',
    mean: 0.5,
    sd: Math.sqrt(1 / 12),
    skewness: 0,
    pdf: (x) => (x >= 0 && x <= 1 ? 1 : 0),
    domain: [-0.15, 1.15],
    draw: (uniform) => uniform(),
  },
  exponential: {
    key: 'exponential',
    label: 'Exponential',
    mean: 1,
    sd: 1,
    skewness: 2,
    pdf: (x) => (x >= 0 ? Math.exp(-x) : 0),
    domain: [0, 5],
    draw: (uniform) => -Math.log(Math.max(1 - uniform(), Number.MIN_VALUE)),
  },
  bimodal: {
    key: 'bimodal',
    label: 'Two humps',
    mean: 0.5,
    // E[X^2] = 0.5(0 + s^2) + 0.5(1 + s^2) = 0.5 + s^2, so Var = 0.25 + s^2.
    sd: Math.sqrt(0.25 + BIMODAL_SPREAD * BIMODAL_SPREAD),
    skewness: 0,
    pdf: (x) => 0.5 * normalPdf(x, 0, BIMODAL_SPREAD) + 0.5 * normalPdf(x, 1, BIMODAL_SPREAD),
    domain: [-0.5, 1.5],
    draw: (uniform, normal) => (uniform() < 0.5 ? 0 : 1) + normal() * BIMODAL_SPREAD,
  },
  lognormal: {
    key: 'lognormal',
    label: 'Lognormal',
    mean: Math.exp(0.5),
    sd: Math.sqrt((E - 1) * E),
    skewness: (E + 2) * Math.sqrt(E - 1),
    pdf: (x) =>
      x <= 0
        ? 0
        : Math.exp(-((Math.log(x) / LOGNORMAL_SIGMA) ** 2) / 2) /
          (x * LOGNORMAL_SIGMA * Math.sqrt(2 * Math.PI)),
    domain: [0, 8],
    draw: (_uniform, normal) => Math.exp(normal() * LOGNORMAL_SIGMA),
  },
};

export interface CltInputs {
  parent: ParentKey;
  /** How many observations go into each mean. */
  sampleSize: number;
  /** How many means to draw. */
  draws: number;
  bins: number;
  sample: number;
}

export interface Bin {
  from: number;
  to: number;
  count: number;
  /** Count normalised so the histogram integrates to 1, comparable to a pdf. */
  density: number;
  /**
   * How much of `count` came from draws outside the plotted window, folded in
   * here. Only ever non-zero on the two end bins. The view marks these, because
   * an unmarked overflow bar reads as a second mode that is not there.
   */
  folded: number;
}

export interface CltOutcome {
  means: Float64Array;
  bins: Bin[];
  observedMean: number;
  observedSd: number;
  observedSkew: number;
  /** What the central limit theorem predicts for these inputs. */
  predictedMean: number;
  predictedSd: number;
  predictedSkew: number;
  parent: Parent;
  /** Plot range for the means. */
  domain: readonly [number, number];
  peakDensity: number;
  /** Draws that fell outside the window and were folded into the end bars. */
  outsideWindow: number;
}

/** Draw `draws` sample means, each of `sampleSize` observations. */
export function drawMeans(inputs: CltInputs): Float64Array {
  const parent = PARENTS[inputs.parent];
  const rng = mulberry32(inputs.sample * 2654435761 + inputs.sampleSize * 40503);
  const normal = normalSampler(rng);

  const out = new Float64Array(inputs.draws);
  for (let i = 0; i < inputs.draws; i++) {
    let total = 0;
    for (let j = 0; j < inputs.sampleSize; j++) total += parent.draw(rng, normal);
    out[i] = total / inputs.sampleSize;
  }
  return out;
}

export function moments(xs: Float64Array): { mean: number; sd: number; skewness: number } {
  const n = xs.length;
  if (n === 0) return { mean: NaN, sd: NaN, skewness: NaN };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += xs[i]!;
  const mean = sum / n;

  let m2 = 0;
  let m3 = 0;
  for (let i = 0; i < n; i++) {
    const d = xs[i]! - mean;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= n;
  m3 /= n;
  const sd = Math.sqrt(m2);
  // Population skewness; with n in the thousands the bias correction is noise.
  const skewness = sd === 0 ? 0 : m3 / (sd * sd * sd);
  return { mean, sd, skewness };
}

export function histogram(
  xs: Float64Array,
  domain: readonly [number, number],
  binCount: number,
): Bin[] {
  const [lo, hi] = domain;
  const width = (hi - lo) / binCount;
  const counts = new Array<number>(binCount).fill(0);
  const folded = new Array<number>(binCount).fill(0);

  for (let i = 0; i < xs.length; i++) {
    const raw = Math.floor((xs[i]! - lo) / width);
    const idx = Math.min(binCount - 1, Math.max(0, raw));
    // Values outside the plotted range are folded into the end bins rather than
    // dropped, so the bars always account for every draw — but the fact that
    // they were folded is recorded, not hidden.
    counts[idx]! += 1;
    if (raw !== idx) folded[idx]! += 1;
  }

  const total = xs.length;
  return counts.map((count, i) => ({
    from: lo + i * width,
    to: lo + (i + 1) * width,
    count,
    density: total === 0 ? 0 : count / (total * width),
    folded: folded[i]!,
  }));
}

export function solve(inputs: CltInputs): CltOutcome {
  const parent = PARENTS[inputs.parent];
  const means = drawMeans(inputs);
  const observed = moments(means);

  const predictedSd = parent.sd / Math.sqrt(inputs.sampleSize);
  const predictedSkew = parent.skewness / Math.sqrt(inputs.sampleSize);

  // A fixed window of four predicted standard deviations keeps the axis stable
  // while the reader drags, instead of rescaling to whatever this sample hit.
  const half = 4 * predictedSd;
  const domain: [number, number] = [parent.mean - half, parent.mean + half];

  const bins = histogram(means, domain, inputs.bins);
  const peakDensity = Math.max(
    normalPdf(parent.mean, parent.mean, predictedSd),
    ...bins.map((b) => b.density),
  );

  return {
    means,
    bins,
    outsideWindow: bins.reduce((sum, b) => sum + b.folded, 0),
    observedMean: observed.mean,
    observedSd: observed.sd,
    observedSkew: observed.skewness,
    predictedMean: parent.mean,
    predictedSd,
    predictedSkew,
    parent,
    domain,
    peakDensity,
  };
}

/** §9: what the histogram currently shows. */
export function describe(inputs: CltInputs, outcome: CltOutcome): string {
  const shape =
    Math.abs(outcome.observedSkew) < 0.2
      ? 'The histogram is close to symmetric'
      : Math.abs(outcome.observedSkew) < 0.6
        ? 'The histogram still leans noticeably'
        : 'The histogram is strongly lopsided';

  return (
    `${outcome.parent.label} parent, ${inputs.draws} sample means of ${inputs.sampleSize} ` +
    `observations each. The means have average ${outcome.observedMean.toFixed(3)} against a ` +
    `predicted ${outcome.predictedMean.toFixed(3)}, and spread ${outcome.observedSd.toFixed(3)} ` +
    `against a predicted ${outcome.predictedSd.toFixed(3)}. ` +
    `${shape}: skewness ${outcome.observedSkew.toFixed(2)}, ` +
    `predicted ${outcome.predictedSkew.toFixed(2)}.` +
    (outcome.outsideWindow > 0
      ? ` ${outcome.outsideWindow} of them fall beyond the plotted range and are stacked into ` +
        'the end bars.'
      : '')
  );
}
