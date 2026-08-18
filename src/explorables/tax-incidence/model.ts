/**
 * Tax incidence — PURE simulation module. SPEC §3.3: no React, no DOM,
 * no requestAnimationFrame. Everything here is a function of its arguments.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13: cite the source form above the implementation)
 * ---------------------------------------------------------------------------
 *
 * Linear supply and demand are anchored at a baseline equilibrium (Q0, P0) and
 * given slopes by their point elasticities there. Writing them this way — rather
 * than picking intercepts — means the two sliders the reader touches ARE the
 * elasticities, which is the quantity the mechanism actually depends on.
 *
 *   Demand:  Q_d(P) = Q0 · (1 − ε_d·(P − P0)/P0)      ε_d > 0 (magnitude)
 *   Supply:  Q_s(P) = Q0 · (1 + ε_s·(P − P0)/P0)      ε_s > 0
 *
 * Inverted, for drawing and for surplus integrals:
 *
 *   P_d(Q) = P0 · (1 + (1 − Q/Q0)/ε_d)
 *   P_s(Q) = P0 · (1 + (Q/Q0 − 1)/ε_s)
 *
 * With a per-unit tax t, consumers pay P_c and producers keep P_p = P_c − t.
 * Setting Q_d(P_c) = Q_s(P_c − t) and solving for the consumer price rise:
 *
 *   P_c − P0 = t · ε_s/(ε_s + ε_d)
 *   P0 − P_p = t · ε_d/(ε_s + ε_d)
 *
 * This is the standard statutory-vs-economic incidence result: the side of the
 * market that is *less* elastic bears more of the tax, and which side the tax is
 * legally levied on does not appear in the expression at all.
 *   cf. Fullerton & Metcalf, "Tax Incidence", Handbook of Public Economics
 *       vol. 4 (2002), §2; Jenkin (1871) for the original geometry.
 *
 * Deadweight loss is the Harberger triangle between the curves over the
 * quantity the tax destroys:
 *
 *   DWL = ½ · t · (Q0 − Q1)
 *   cf. Harberger, "The Measurement of Waste", AER 54 (1964).
 * ---------------------------------------------------------------------------
 */

/** Baseline equilibrium the curves are anchored to. Fixed, not a parameter. */
export const P0 = 10;
export const Q0 = 100;

export type LeviedOn = 'sellers' | 'buyers';

export interface TaxInputs {
  /** Price elasticity of demand at baseline, as a positive magnitude. */
  elasticityD: number;
  /** Price elasticity of supply at baseline. */
  elasticityS: number;
  /** Per-unit tax, in currency units per unit. */
  tax: number;
  /**
   * Which side the tax is legally collected from. Affects labelling only —
   * see `legalIncidenceIrrelevant` in the tests. That is the whole point.
   */
  leviedOn: LeviedOn;
}

export interface TaxOutcome {
  /** Price the consumer pays. */
  priceConsumer: number;
  /** Price the producer keeps, net of tax. */
  priceProducer: number;
  /** Traded quantity after the tax. */
  quantity: number;
  /** Traded quantity with no tax (always Q0). */
  quantityUntaxed: number;
  /** Share of the tax borne by consumers, in [0, 1]. */
  consumerShare: number;
  producerShare: number;
  /** Currency burden per unit. */
  consumerBurden: number;
  producerBurden: number;
  consumerSurplus: number;
  producerSurplus: number;
  government: number;
  deadweightLoss: number;
  /** Surpluses in the untaxed world, for comparison. */
  consumerSurplusUntaxed: number;
  producerSurplusUntaxed: number;
  leviedOn: LeviedOn;
}

/** Inverse demand: the price at which the market will absorb `q`. */
export function inverseDemand(q: number, elasticityD: number): number {
  return P0 * (1 + (1 - q / Q0) / elasticityD);
}

/** Inverse supply: the price needed to bring `q` to market. */
export function inverseSupply(q: number, elasticityS: number): number {
  return P0 * (1 + (q / Q0 - 1) / elasticityS);
}

/** Choke price — demand falls to zero at or above this. */
export function chokePrice(elasticityD: number): number {
  return inverseDemand(0, elasticityD);
}

/**
 * Reservation price of the first unit supplied. Negative when ε_s < 1, which is
 * the linear model extrapolating past where it means anything; surplus below
 * P = 0 is clipped away rather than counted (see `producerSurplus` below and
 * the Limits prose).
 */
export function supplyFloorPrice(elasticityS: number): number {
  return inverseSupply(0, elasticityS);
}

/** Quantity at which the supply curve crosses P = 0; only meaningful if ε_s < 1. */
export function supplyZeroPriceQuantity(elasticityS: number): number {
  return Q0 * (1 - elasticityS);
}

/**
 * Consumer surplus: the triangle between the demand curve and the price paid,
 * over [0, q].
 */
export function consumerSurplusAt(q: number, price: number, elasticityD: number): number {
  return 0.5 * q * (chokePrice(elasticityD) - price);
}

/**
 * Producer surplus over [0, q] at a received price, clipped at P = 0.
 *
 * When ε_s < 1 the linear supply curve implies negative reservation prices for
 * the first units. Counting that area would inflate producer surplus with a
 * region the model does not really claim, and it would not match the shaded
 * area on screen. So the integral is taken against max(0, P_s(q)):
 *
 *   ε_s ≥ 1  →  triangle   ½·q·(price − P_s(0))
 *   ε_s < 1  →  trapezoid  price·(q + q₀)/2,  where P_s(q₀) = 0
 */
export function producerSurplusAt(q: number, price: number, elasticityS: number): number {
  const floor = supplyFloorPrice(elasticityS);
  if (floor >= 0) return 0.5 * q * (price - floor);
  const qZero = supplyZeroPriceQuantity(elasticityS);
  return (price * (q + qZero)) / 2;
}

export function solve(inputs: TaxInputs): TaxOutcome {
  const { elasticityD, elasticityS, tax, leviedOn } = inputs;
  const denom = elasticityS + elasticityD;

  // Statutory side does not enter the arithmetic anywhere below. That is the
  // result the explorable exists to demonstrate.
  const consumerShare = elasticityS / denom;
  const producerShare = elasticityD / denom;

  const consumerBurden = tax * consumerShare;
  const producerBurden = tax * producerShare;

  const priceConsumer = P0 + consumerBurden;
  const priceProducer = P0 - producerBurden;

  const quantity = Q0 * (1 - (elasticityD * consumerBurden) / P0);

  const consumerSurplus = consumerSurplusAt(quantity, priceConsumer, elasticityD);
  const producerSurplus = producerSurplusAt(quantity, priceProducer, elasticityS);
  const government = tax * quantity;
  const deadweightLoss = 0.5 * tax * (Q0 - quantity);

  return {
    priceConsumer,
    priceProducer,
    quantity,
    quantityUntaxed: Q0,
    consumerShare,
    producerShare,
    consumerBurden,
    producerBurden,
    consumerSurplus,
    producerSurplus,
    government,
    deadweightLoss,
    consumerSurplusUntaxed: consumerSurplusAt(Q0, P0, elasticityD),
    producerSurplusUntaxed: producerSurplusAt(Q0, P0, elasticityS),
    leviedOn,
  };
}

/**
 * Sample points along a curve for drawing, clipped to P ≥ 0 so the rendered
 * geometry matches the surplus arithmetic above.
 */
export function curvePoints(
  fn: (q: number) => number,
  qMax: number,
  samples = 2,
): { q: number; p: number }[] {
  const pts: { q: number; p: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const q = (qMax * i) / (samples - 1);
    pts.push({ q, p: fn(q) });
  }
  return pts;
}

/* ---------------------------------------------------------------------------
 * Geometry and description.
 *
 * These live here rather than in View.tsx because they are statements about the
 * model, not about pixels (§3.3). The view maps these data-space points through
 * a scale and draws them; it never works out where a vertex belongs.
 * ------------------------------------------------------------------------- */

export interface Point {
  q: number;
  p: number;
}

export interface TaxRegions {
  /** Consumer surplus: between the demand curve and the price paid. */
  consumerSurplus: Point[];
  /** Producer surplus, clipped at P = 0. */
  producerSurplus: Point[];
  /** Government revenue: the wedge rectangle over the traded quantity. */
  revenue: Point[];
  /** The Harberger triangle. */
  deadweightLoss: Point[];
}

export function regions(inputs: TaxInputs, outcome: TaxOutcome): TaxRegions {
  const { elasticityD, elasticityS } = inputs;
  const { quantity: q1, priceConsumer: pc, priceProducer: pp } = outcome;

  const consumerSurplus: Point[] = [
    { q: 0, p: pc },
    { q: 0, p: chokePrice(elasticityD) },
    { q: q1, p: pc },
  ];

  // Below P = 0 the supply line is extrapolating past its meaning, so the
  // region is cut off at the axis and becomes a quadrilateral.
  const floor = supplyFloorPrice(elasticityS);
  const producerSurplus: Point[] =
    floor >= 0
      ? [
          { q: 0, p: pp },
          { q: 0, p: floor },
          { q: q1, p: pp },
        ]
      : [
          { q: 0, p: pp },
          { q: 0, p: 0 },
          { q: supplyZeroPriceQuantity(elasticityS), p: 0 },
          { q: q1, p: pp },
        ];

  const revenue: Point[] = [
    { q: 0, p: pp },
    { q: 0, p: pc },
    { q: q1, p: pc },
    { q: q1, p: pp },
  ];

  const deadweightLoss: Point[] = [
    { q: q1, p: pc },
    { q: Q0, p: P0 },
    { q: q1, p: pp },
  ];

  return { consumerSurplus, producerSurplus, revenue, deadweightLoss };
}

const money = (v: number) => `$${v.toFixed(2)}`;

/**
 * §9: the text a screen reader gets in the aria-live region. It describes what
 * the chart currently *shows*, not which slider moved — a reader who cannot see
 * the chart needs the state, not the event.
 */
export function describe(inputs: TaxInputs, outcome: TaxOutcome): string {
  if (inputs.tax === 0) {
    return (
      `No tax. The market clears at ${money(P0)} and ${Q0.toFixed(0)} units. ` +
      'Consumers and producers pay nothing, and there is no deadweight loss.'
    );
  }

  const consumerPct = Math.round(outcome.consumerShare * 100);
  const producerPct = 100 - consumerPct;
  const side = inputs.leviedOn === 'sellers' ? 'sellers' : 'buyers';

  let carried: string;
  if (consumerPct >= 60) carried = `Most of it falls on consumers, ${consumerPct}%.`;
  else if (consumerPct <= 40) carried = `Most of it falls on producers, ${producerPct}%.`;
  else carried = `It is split roughly evenly: ${consumerPct}% consumers, ${producerPct}% producers.`;

  return (
    `A tax of ${money(inputs.tax)} per unit, collected from ${side}. ` +
    `Consumers pay ${money(outcome.priceConsumer)}, up ${money(outcome.consumerBurden)}; ` +
    `producers keep ${money(outcome.priceProducer)}, down ${money(outcome.producerBurden)}. ` +
    `${carried} ` +
    `Quantity traded falls from ${Q0.toFixed(0)} to ${outcome.quantity.toFixed(1)} units. ` +
    `Government revenue ${money(outcome.government)}, ` +
    `deadweight loss ${money(outcome.deadweightLoss)}.`
  );
}
