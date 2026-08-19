import { describe, expect, it } from 'vitest';
import { scaleLog } from 'd3-scale';
import { registry } from '../registry';
import { quantise, toSignificantFigures, type ContinuousParam } from './params';

/** Mirrors the slider resolution in Controls.tsx. */
const LOG_STEPS = 1000;

const logParams: Array<{ slug: string; spec: ContinuousParam }> = registry.flatMap(
  ({ meta, schema }) =>
    (schema as readonly { kind: string }[])
      .filter((spec): spec is ContinuousParam => spec.kind === 'continuous')
      .filter((spec) => spec.scale === 'log')
      .map((spec) => ({ slug: meta.slug, spec })),
);

describe('significant-figure rounding', () => {
  it('keeps the requested number of figures at any magnitude', () => {
    expect(toSignificantFigures(0.000123456, 4)).toBeCloseTo(0.0001235, 12);
    expect(toSignificantFigures(1.23456, 4)).toBeCloseTo(1.235, 12);
    expect(toSignificantFigures(98765, 4)).toBeCloseTo(98770, 12);
    expect(toSignificantFigures(0, 4)).toBe(0);
  });
});

describe('every log-scale slider in the registry can actually move', () => {
  it('has at least one log parameter to check', () => {
    expect(logParams.length).toBeGreaterThan(0);
  });

  /**
   * The regression this guards: quantising a log parameter onto an absolute
   * step grid rounds adjacent slider positions to the same value, so the
   * control sticks and neither dragging nor an arrow key moves it.
   */
  it.each(logParams.map(({ slug, spec }) => [`${slug}/${spec.id}`, spec] as const))(
    '%s gives a distinct value at every slider position',
    (_label, spec) => {
      const scale = scaleLog().domain([spec.min, spec.max]).range([0, LOG_STEPS]);

      let stuck = 0;
      let previous = quantise(spec, scale.invert(0));
      for (let position = 1; position <= LOG_STEPS; position++) {
        const value = quantise(spec, scale.invert(position));
        if (value === previous) stuck++;
        previous = value;
      }

      expect(stuck).toBe(0);
    },
  );

  it.each(logParams.map(({ slug, spec }) => [`${slug}/${spec.id}`, spec] as const))(
    '%s stays inside its declared range',
    (_label, spec) => {
      const scale = scaleLog().domain([spec.min, spec.max]).range([0, LOG_STEPS]);
      for (let position = 0; position <= LOG_STEPS; position += 7) {
        const value = quantise(spec, scale.invert(position));
        expect(value).toBeGreaterThanOrEqual(spec.min);
        expect(value).toBeLessThanOrEqual(spec.max);
      }
    },
  );

  it.each(logParams.map(({ slug, spec }) => [`${slug}/${spec.id}`, spec] as const))(
    '%s round-trips its default unchanged',
    (_label, spec) => {
      expect(quantise(spec, spec.default)).toBeCloseTo(spec.default, 10);
    },
  );
});
