import { describe, expect, it } from 'vitest';
import {
  P0,
  Q0,
  consumerSurplusAt,
  inverseDemand,
  inverseSupply,
  producerSurplusAt,
  solve,
  supplyFloorPrice,
  supplyZeroPriceQuantity,
  type TaxInputs,
} from './model';

const base: TaxInputs = { elasticityD: 1, elasticityS: 1, tax: 2, leviedOn: 'sellers' };

/** Numeric integration, used to check the closed forms independently. */
function integrate(f: (q: number) => number, a: number, b: number, n = 200_000): number {
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += f(a + h * (i + 0.5));
  return sum * h;
}

describe('tax incidence — analytical results', () => {
  // §8: "tax incidence split against the elasticity ratio formula"
  it('splits the tax in the ratio of elasticities: consumer share = e_s/(e_s + e_d)', () => {
    const cases: Array<[number, number]> = [
      [1, 1],
      [0.5, 2],
      [2, 0.5],
      [0.2, 3],
      [3, 0.2],
      [1.7, 0.9],
    ];
    for (const [elasticityD, elasticityS] of cases) {
      const out = solve({ ...base, elasticityD, elasticityS, tax: 3 });
      expect(out.consumerShare).toBeCloseTo(elasticityS / (elasticityS + elasticityD), 12);
      expect(out.producerShare).toBeCloseTo(elasticityD / (elasticityS + elasticityD), 12);
      expect(out.consumerShare + out.producerShare).toBeCloseTo(1, 12);
      // The two burdens must sum to exactly the tax.
      expect(out.consumerBurden + out.producerBurden).toBeCloseTo(3, 12);
      expect(out.priceConsumer - out.priceProducer).toBeCloseTo(3, 12);
    }
  });

  // The thesis of the explorable, asserted as a test.
  it('is indifferent to which side the tax is legally levied on', () => {
    const onSellers = solve({ ...base, elasticityD: 0.4, elasticityS: 2.2, leviedOn: 'sellers' });
    const onBuyers = solve({ ...base, elasticityD: 0.4, elasticityS: 2.2, leviedOn: 'buyers' });
    expect(onBuyers.priceConsumer).toBeCloseTo(onSellers.priceConsumer, 12);
    expect(onBuyers.priceProducer).toBeCloseTo(onSellers.priceProducer, 12);
    expect(onBuyers.quantity).toBeCloseTo(onSellers.quantity, 12);
    expect(onBuyers.deadweightLoss).toBeCloseTo(onSellers.deadweightLoss, 12);
  });

  it('gives an equal split when elasticities are equal', () => {
    const out = solve({ ...base, elasticityD: 1.3, elasticityS: 1.3, tax: 4 });
    expect(out.consumerBurden).toBeCloseTo(2, 12);
    expect(out.producerBurden).toBeCloseTo(2, 12);
  });

  it('loads the burden onto the inelastic side', () => {
    // Supply far more elastic than demand -> consumers pay nearly all of it.
    const inelasticDemand = solve({ ...base, elasticityD: 0.2, elasticityS: 3, tax: 3 });
    expect(inelasticDemand.consumerShare).toBeGreaterThan(0.9);

    // And the mirror image.
    const inelasticSupply = solve({ ...base, elasticityD: 3, elasticityS: 0.2, tax: 3 });
    expect(inelasticSupply.producerShare).toBeGreaterThan(0.9);
  });

  it('leaves the market undistorted at zero tax', () => {
    const out = solve({ ...base, tax: 0 });
    expect(out.priceConsumer).toBeCloseTo(P0, 12);
    expect(out.priceProducer).toBeCloseTo(P0, 12);
    expect(out.quantity).toBeCloseTo(Q0, 12);
    expect(out.deadweightLoss).toBeCloseTo(0, 12);
    expect(out.government).toBeCloseTo(0, 12);
  });

  it('clears the market: quantity demanded at P_c equals quantity supplied at P_p', () => {
    const out = solve({ ...base, elasticityD: 0.7, elasticityS: 1.9, tax: 5 });
    // Inverting the curves at the solved quantity must return the two prices.
    expect(inverseDemand(out.quantity, 0.7)).toBeCloseTo(out.priceConsumer, 10);
    expect(inverseSupply(out.quantity, 1.9)).toBeCloseTo(out.priceProducer, 10);
  });
});

describe('tax incidence — welfare arithmetic', () => {
  // Harberger: DWL = 1/2 * t * (Q0 - Q1)
  it('computes deadweight loss as the Harberger triangle', () => {
    const out = solve({ ...base, elasticityD: 1.1, elasticityS: 0.8, tax: 4 });
    expect(out.deadweightLoss).toBeCloseTo(0.5 * 4 * (Q0 - out.quantity), 12);
  });

  it('conserves surplus: untaxed total = taxed total + revenue + deadweight loss', () => {
    const cases: Array<[number, number, number]> = [
      [1, 1, 2],
      [0.3, 2.5, 5],
      [2.5, 0.3, 5],
      [0.2, 0.2, 6], // both inelastic; supply floor is far below zero
      [3, 3, 6],
    ];
    for (const [elasticityD, elasticityS, tax] of cases) {
      const out = solve({ ...base, elasticityD, elasticityS, tax });
      const before = out.consumerSurplusUntaxed + out.producerSurplusUntaxed;
      const after = out.consumerSurplus + out.producerSurplus + out.government + out.deadweightLoss;
      expect(after).toBeCloseTo(before, 8);
    }
  });

  it('matches numeric integration for consumer surplus', () => {
    const eD = 0.9;
    const out = solve({ ...base, elasticityD: eD, elasticityS: 1.4, tax: 3 });
    const numeric = integrate(
      (q) => Math.max(0, inverseDemand(q, eD) - out.priceConsumer),
      0,
      out.quantity,
    );
    expect(out.consumerSurplus).toBeCloseTo(numeric, 4);
  });

  it('matches numeric integration for producer surplus, clipped at P = 0', () => {
    // The model integrates against the supply curve floored at zero, i.e.
    // max(0, P_s(q)) — not against the raw line. Below P = 0 the linear
    // extrapolation is not making a claim we want to count as surplus, and the
    // floored version is also what gets shaded on screen.
    const clippedSupply = (q: number, eS: number) => Math.max(0, inverseSupply(q, eS));

    // e_s >= 1: supply floor already at or above zero, so this is a plain triangle
    // and the flooring changes nothing.
    const highS = 1.5;
    const a = solve({ ...base, elasticityD: 1, elasticityS: highS, tax: 3 });
    expect(supplyFloorPrice(highS)).toBeGreaterThanOrEqual(0);
    expect(a.producerSurplus).toBeCloseTo(
      integrate((q) => Math.max(0, a.priceProducer - clippedSupply(q, highS)), 0, a.quantity),
      4,
    );

    // e_s < 1: the linear curve dips below P = 0, so the region is a trapezoid.
    const lowS = 0.4;
    const b = solve({ ...base, elasticityD: 1, elasticityS: lowS, tax: 3 });
    expect(supplyFloorPrice(lowS)).toBeLessThan(0);
    expect(supplyZeroPriceQuantity(lowS)).toBeGreaterThan(0);
    expect(b.producerSurplus).toBeCloseTo(
      integrate((q) => Math.max(0, b.priceProducer - clippedSupply(q, lowS)), 0, b.quantity),
      4,
    );

    // And the flooring is not a rounding detail: against the raw line the same
    // case would report substantially more surplus.
    const unclipped = integrate(
      (q) => Math.max(0, b.priceProducer - inverseSupply(q, lowS)),
      0,
      b.quantity,
    );
    expect(unclipped).toBeGreaterThan(b.producerSurplus * 1.5);
  });

  it('keeps every reported quantity non-negative across the whole parameter range', () => {
    for (let eD = 0.2; eD <= 3.0001; eD += 0.2) {
      for (let eS = 0.2; eS <= 3.0001; eS += 0.2) {
        for (let t = 0; t <= 6.0001; t += 0.5) {
          const out = solve({ elasticityD: eD, elasticityS: eS, tax: t, leviedOn: 'sellers' });
          expect(out.quantity).toBeGreaterThan(0);
          expect(out.priceProducer).toBeGreaterThan(0);
          expect(out.consumerSurplus).toBeGreaterThanOrEqual(0);
          expect(out.producerSurplus).toBeGreaterThanOrEqual(0);
          expect(out.deadweightLoss).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('exposes surplus helpers that agree with the solved outcome', () => {
    const out = solve({ ...base, elasticityD: 1.2, elasticityS: 0.6, tax: 2.5 });
    expect(consumerSurplusAt(out.quantity, out.priceConsumer, 1.2)).toBeCloseTo(
      out.consumerSurplus,
      10,
    );
    expect(producerSurplusAt(out.quantity, out.priceProducer, 0.6)).toBeCloseTo(
      out.producerSurplus,
      10,
    );
  });
});
