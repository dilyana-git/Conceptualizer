/**
 * Simpson's paradox — PURE simulation module. SPEC §3.3.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13)
 * ---------------------------------------------------------------------------
 * k balanced groups. Group g (g = 0 .. k-1) is centred at x = g*sep and
 * y = g*shift, and holds n points spread evenly across a fixed width w:
 *
 *     x_gi = g*sep - w/2 + w*i/(n-1)
 *     y_gi = g*shift + within*(x_gi - g*sep) + noise
 *
 * The pooled least-squares slope follows from the standard decomposition of a
 * covariance into within- and between-group parts:
 *
 *     Cov(x,y) = within*sx^2 + sep*shift*vg
 *     Var(x)   = sx^2 + sep^2*vg
 *
 *     pooled = (within*sx^2 + sep*shift*vg) / (sx^2 + sep^2*vg)
 *
 * where sx^2 is the within-group variance of x and vg the variance of the group
 * index. Both are exact here because the design is balanced and evenly spaced:
 *
 *     sx^2 = w^2 (n+1) / (12 (n-1))        (evenly spaced points)
 *     vg   = (k^2 - 1) / 12                (g uniform on 0..k-1)
 *
 * Reading the numerator tells you the whole story: the within-group slope is
 * weighted by the spread *inside* groups, the between-group slope by the spread
 * *across* them. Offset the groups hard enough, or separate them enough, and
 * the second term dominates and the sign flips. Nothing is paradoxical about it
 * once the two variances are written next to each other — which is precisely
 * why the paradox is a warning about aggregation, not about regression.
 *
 * The dependence on separation is worth stating carefully, because the obvious
 * guess is wrong. As sep -> 0 the pooled slope tends to `within` and there is no
 * reversal at all. As sep grows the slope falls, crosses zero, and reaches a
 * minimum; past that it climbs back toward zero, tracking shift/sep. So the
 * reversal is *strongest at an intermediate separation* and grows weaker — while
 * remaining a reversal — as the groups are pulled further apart. Separating
 * groups adds between-group variance to the denominator faster than it adds
 * covariance to the numerator.
 *
 * cf. Simpson, "The Interpretation of Interaction in Contingency Tables",
 * JRSS B 13 (1951); Yule (1903) for the earlier association form.
 * ---------------------------------------------------------------------------
 */
import { mulberry32, normalSampler, olsLine, type Line } from '../../lib/stats';

/** Points per group, and the x-width each group spans. Fixed, not parameters. */
export const N_PER_GROUP = 30;
export const GROUP_WIDTH = 1.6;

export interface SimpsonInputs {
  /** Number of groups, 2..5. */
  groups: number;
  /** Horizontal distance between adjacent group centres. */
  separation: number;
  /** Vertical offset added per group; negative values drive the reversal. */
  shift: number;
  /** Slope inside every group. */
  within: number;
  /** Standard deviation of the vertical noise. */
  noise: number;
  sample: number;
}

export interface Point {
  x: number;
  y: number;
  group: number;
}

export interface SimpsonOutcome {
  points: Point[];
  /** Least-squares fit inside each group, in group order. */
  withinLines: Line[];
  /** Least-squares fit ignoring the grouping entirely. */
  pooled: Line;
  /** Mean of the per-group fitted slopes. */
  meanWithinSlope: number;
  /** Closed-form pooled slope for these settings (noise-free expectation). */
  predictedPooledSlope: number;
  /** True when the pooled slope contradicts the within-group slopes. */
  reversed: boolean;
  xDomain: [number, number];
  yDomain: [number, number];
}

/** Within-group variance of x for n evenly spaced points across width w. */
export function withinVarianceX(n = N_PER_GROUP, w = GROUP_WIDTH): number {
  return (w * w * (n + 1)) / (12 * (n - 1));
}

/** Variance of a group index uniform on 0..k-1. */
export function groupIndexVariance(k: number): number {
  return (k * k - 1) / 12;
}

/** The closed-form pooled slope derived in the header. */
export function predictPooledSlope(inputs: SimpsonInputs): number {
  const { groups, separation, shift, within } = inputs;
  const sx2 = withinVarianceX();
  const vg = groupIndexVariance(groups);
  const denom = sx2 + separation * separation * vg;
  if (denom === 0) return within;
  return (within * sx2 + separation * shift * vg) / denom;
}

export function generate(inputs: SimpsonInputs): Point[] {
  const { groups, separation, shift, within, noise, sample } = inputs;
  const nextNormal = normalSampler(mulberry32(sample * 7919 + groups * 31));
  const points: Point[] = [];

  for (let g = 0; g < groups; g++) {
    const cx = g * separation;
    const cy = g * shift;
    for (let i = 0; i < N_PER_GROUP; i++) {
      const offset = -GROUP_WIDTH / 2 + (GROUP_WIDTH * i) / (N_PER_GROUP - 1);
      const x = cx + offset;
      const y = cy + within * offset + noise * nextNormal();
      points.push({ x, y, group: g });
    }
  }
  return points;
}

export function solve(inputs: SimpsonInputs): SimpsonOutcome {
  const points = generate(inputs);

  const withinLines: Line[] = [];
  for (let g = 0; g < inputs.groups; g++) {
    const inGroup = points.filter((p) => p.group === g);
    withinLines.push(olsLine(inGroup.map((p) => p.x), inGroup.map((p) => p.y)));
  }

  const pooled = olsLine(points.map((p) => p.x), points.map((p) => p.y));
  const meanWithinSlope =
    withinLines.reduce((sum, l) => sum + l.slope, 0) / Math.max(1, withinLines.length);

  // A reversal is a genuine sign disagreement, not merely a shallower slope.
  const reversed =
    Math.sign(meanWithinSlope) !== 0 &&
    Math.sign(pooled.slope) !== 0 &&
    Math.sign(meanWithinSlope) !== Math.sign(pooled.slope);

  // Axis extents are snapped to a coarse grid: an exactly-fitted domain would
  // shift on every frame as a slider moves, and a plot whose axes crawl while
  // you drag is impossible to read a trend off.
  const snap = (v: number, dir: -1 | 1) => (dir < 0 ? Math.floor(v) : Math.ceil(v));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xDomain: [number, number] = [snap(Math.min(...xs) - 0.5, -1), snap(Math.max(...xs) + 0.5, 1)];
  const yDomain: [number, number] = [snap(Math.min(...ys) - 0.5, -1), snap(Math.max(...ys) + 0.5, 1)];

  return {
    points,
    withinLines,
    pooled,
    meanWithinSlope,
    predictedPooledSlope: predictPooledSlope(inputs),
    reversed,
    xDomain,
    yDomain,
  };
}

/** §9: what the chart currently shows. */
export function describe(inputs: SimpsonInputs, outcome: SimpsonOutcome): string {
  const within = outcome.meanWithinSlope;
  const pooled = outcome.pooled.slope;
  const direction = (v: number) => (v > 0 ? 'upward' : v < 0 ? 'downward' : 'flat');

  const base =
    `${inputs.groups} groups of ${N_PER_GROUP} points. Inside each group the trend is ` +
    `${direction(within)}, slope ${within.toFixed(2)}. Pooled together and ignoring the ` +
    `grouping, the trend is ${direction(pooled)}, slope ${pooled.toFixed(2)}.`;

  return outcome.reversed
    ? `${base} The two answers have opposite signs: this is a reversal.`
    : `${base} Both point the same way, so there is no reversal at these settings.`;
}
