import { describe, expect, it } from 'vitest';
import {
  EXTENT,
  amplitudeAt,
  fillField,
  intensityAt,
  nodalPathDifferences,
  pathDifference,
  solve,
  sources,
  waveNumber,
  type WaveInputs,
} from './model';
const base: WaveInputs = {
  separation: 0.6,
  wavelength: 0.15,
  phase: 0,
  mode: 'intensity',
};
describe('geometry', () => {
  it('places the sources symmetrically about the origin', () => {
    const { a, b } = sources(0.8);
    expect(a).toEqual({ x: 0, y: 0.4 });
    expect(b).toEqual({ x: 0, y: -0.4 });
  });
  it('gives zero path difference on the perpendicular bisector', () => {
    for (const x of [0.1, 0.5, 1, 5]) {
      expect(pathDifference(x, 0, 0.6)).toBeCloseTo(0, 12);
    }
  });
  it('never exceeds the separation, and reaches it only beyond the sources', () => {
    const separation = 0.6;
    for (const x of [-1, -0.3, 0, 0.4, 1]) {
      for (const y of [-1, -0.2, 0, 0.5, 1]) {
        expect(Math.abs(pathDifference(x, y, separation))).toBeLessThanOrEqual(separation + 1e-12);
      }
    }
    // On the axis through both sources, outside them, it saturates.
    expect(pathDifference(0, 50, separation)).toBeCloseTo(-separation, 6);
    expect(pathDifference(0, -50, separation)).toBeCloseTo(separation, 6);
  });
});
describe('intensity is the time average of the squared amplitude', () => {
  it('equals twice the mean square over a full period', () => {
    // I = 2 <A^2>, integrated numerically over one period.
    const samples = 20_000;
    for (const [x, y] of [
      [0.4, 0.2],
      [0.9, -0.6],
      [0.05, 0.31],
      [-0.7, 0.4],
    ]) {
      let total = 0;
      for (let i = 0; i < samples; i++) {
        const a = amplitudeAt(x!, y!, base, i / samples);
        total += a * a;
      }
      expect(2 * (total / samples)).toBeCloseTo(intensityAt(x!, y!, base), 5);
    }
  });
  it('stays within [0, 4]', () => {
    for (let x = -EXTENT; x <= EXTENT; x += 0.07) {
      for (let y = -EXTENT; y <= EXTENT; y += 0.07) {
        const i = intensityAt(x, y, base);
        expect(i).toBeGreaterThanOrEqual(-1e-12);
        expect(i).toBeLessThanOrEqual(4 + 1e-12);
      }
    }
  });
});
describe('constructive and destructive conditions', () => {
  const k = waveNumber(base.wavelength);
  it('is fully bright wherever the path difference is a whole number of wavelengths', () => {
    // Construct points directly from the condition rather than searching.
    for (const m of [-2, -1, 0, 1, 2]) {
      const targetDr = m * base.wavelength;
      const point = pointWithPathDifference(targetDr, base.separation);
      expect(pathDifference(point.x, point.y, base.separation)).toBeCloseTo(targetDr, 9);
      expect(intensityAt(point.x, point.y, base)).toBeCloseTo(4, 6);
    }
  });
  it('is fully dark at half-integer path differences', () => {
    for (const m of [-2, -1, 0, 1]) {
      const targetDr = (m + 0.5) * base.wavelength;
      const point = pointWithPathDifference(targetDr, base.separation);
      expect(intensityAt(point.x, point.y, base)).toBeCloseTo(0, 6);
    }
  });
  it('turns the central band dark when the sources are driven out of phase', () => {
    // On the bisector dr = 0, so I = 4 cos^2(phi/2).
    expect(intensityAt(1, 0, { ...base, phase: 0 })).toBeCloseTo(4, 9);
    expect(intensityAt(1, 0, { ...base, phase: Math.PI })).toBeCloseTo(0, 9);
    expect(intensityAt(1, 0, { ...base, phase: Math.PI / 2 })).toBeCloseTo(2, 9);
  });
  it('depends on position only through the path difference', () => {
    // Two quite different points sharing a path difference must match exactly.
    const dr = 0.037;
    const p = pointWithPathDifference(dr, base.separation, 0.35);
    const q = pointWithPathDifference(dr, base.separation, 1.4);
    expect(pathDifference(q.x, q.y, base.separation)).toBeCloseTo(dr, 9);
    expect(intensityAt(p.x, p.y, base)).toBeCloseTo(intensityAt(q.x, q.y, base), 8);
    expect(k).toBeGreaterThan(0);
  });
});
describe('counting the dark bands', () => {
  it('finds none when the sources are closer than half a wavelength', () => {
    const outcome = solve({ ...base, separation: 0.05, wavelength: 0.4 });
    expect(outcome.nodalCount).toBe(0);
  });
  it('counts every half-integer path difference the geometry can reach', () => {
    for (const [separation, wavelength] of [
      [0.6, 0.15],
      [1.0, 0.1],
      [0.3, 0.2],
      [1.2, 0.05],
    ]) {
      const inputs = { ...base, separation: separation!, wavelength: wavelength! };
      const drs = nodalPathDifferences(inputs);
      // Every one is reachable, and one more on each side would not be.
      for (const dr of drs) expect(Math.abs(dr)).toBeLessThanOrEqual(separation!);
      const step = wavelength!;
      expect(Math.abs(Math.min(...drs) - step)).toBeGreaterThan(separation! - step - 1e-9);
      // The closed form for the count: 2 * floor(d/lambda + 1/2).
      expect(drs).toHaveLength(2 * Math.floor(separation! / wavelength! + 0.5));
    }
  });
  it('shifts the whole family by half a wavelength for a half-turn of phase', () => {
    // In phase, the dark bands sit at half-integer multiples of the wavelength.
    for (const dr of nodalPathDifferences({ ...base, phase: 0 })) {
      const inWavelengths = dr / base.wavelength;
      expect(Math.abs(inWavelengths - Math.round(inWavelengths))).toBeCloseTo(0.5, 9);
    }
    // Driven a half-turn out of phase, they land on the whole multiples instead
    // — the pattern has slid over by exactly one half-fringe.
    for (const dr of nodalPathDifferences({ ...base, phase: Math.PI })) {
      const inWavelengths = dr / base.wavelength;
      expect(inWavelengths).toBeCloseTo(Math.round(inWavelengths), 9);
    }
  });
  it('places the far-field bands at the grating angles d sin(theta) = dr', () => {
    const outcome = solve(base);
    for (const theta of outcome.nodalAngles) {
      const dr = base.separation * Math.sin(theta);
      // That path difference must indeed be a dark one.
      const nearest = nodalPathDifferences(base).reduce((best, candidate) =>
        Math.abs(candidate - dr) < Math.abs(best - dr) ? candidate : best,
      );
      expect(nearest).toBeCloseTo(dr, 9);
    }
  });
  it('spreads the fringes further apart as the wavelength grows', () => {
    const tight = solve({ ...base, wavelength: 0.08 });
    const loose = solve({ ...base, wavelength: 0.2 });
    expect(tight.fringeSpacingDegrees).not.toBeNull();
    expect(loose.fringeSpacingDegrees).not.toBeNull();
    expect(loose.fringeSpacingDegrees!).toBeGreaterThan(tight.fringeSpacingDegrees!);
    expect(tight.nodalCount).toBeGreaterThan(loose.nodalCount);
  });
  it('depends only on the ratio of separation to wavelength', () => {
    const small = solve({ ...base, separation: 0.4, wavelength: 0.1 });
    const scaled = solve({ ...base, separation: 0.8, wavelength: 0.2 });
    expect(small.ratio).toBeCloseTo(scaled.ratio, 12);
    expect(small.nodalCount).toBe(scaled.nodalCount);
    expect(small.nodalAngles).toEqual(scaled.nodalAngles);
  });
});
describe('the field buffer', () => {
  it('agrees cell for cell with the scalar functions', () => {
    const resolution = 24;
    const buffer = new Float32Array(resolution * resolution);
    const step = (2 * EXTENT) / resolution;
    for (const mode of ['intensity', 'amplitude'] as const) {
      const inputs = { ...base, mode };
      fillField(buffer, resolution, inputs, 0.3);
      for (const [row, col] of [
        [0, 0],
        [7, 19],
        [23, 23],
        [12, 4],
      ]) {
        const y = EXTENT - step * (row! + 0.5);
        const x = -EXTENT + step * (col! + 0.5);
        const expected =
          mode === 'amplitude' ? amplitudeAt(x, y, inputs, 0.3) : intensityAt(x, y, inputs);
        expect(buffer[row! * resolution + col!]).toBeCloseTo(expected, 5);
      }
    }
  });
  it('is static in intensity mode and moving in amplitude mode', () => {
    const resolution = 16;
    const first = new Float32Array(resolution * resolution);
    const second = new Float32Array(resolution * resolution);
    fillField(first, resolution, { ...base, mode: 'intensity' }, 0);
    fillField(second, resolution, { ...base, mode: 'intensity' }, 0.4);
    expect(Array.from(second)).toEqual(Array.from(first));
    fillField(first, resolution, { ...base, mode: 'amplitude' }, 0);
    fillField(second, resolution, { ...base, mode: 'amplitude' }, 0.25);
    expect(Array.from(second)).not.toEqual(Array.from(first));
  });
  it('repeats exactly after one period', () => {
    const resolution = 16;
    const start = new Float32Array(resolution * resolution);
    const later = new Float32Array(resolution * resolution);
    fillField(start, resolution, { ...base, mode: 'amplitude' }, 0.17);
    fillField(later, resolution, { ...base, mode: 'amplitude' }, 1.17);
    for (let i = 0; i < start.length; i++) {
      expect(later[i]).toBeCloseTo(start[i]!, 5);
    }
  });
  it('holds its frame budget: a full-resolution frame stays well under 16ms', () => {
    // §9 lets this explorable target 30fps, so a frame has ~33ms. The field is
    // the whole of the per-frame work, and it must leave room for the blit.
    const resolution = 260;
    const buffer = new Float32Array(resolution * resolution);
    const started = performance.now();
    for (let frame = 0; frame < 10; frame++) {
      fillField(buffer, resolution, { ...base, mode: 'amplitude' }, frame / 10);
    }
    const perFrame = (performance.now() - started) / 10;
    expect(perFrame).toBeLessThan(16);
  });
});
/**
 * A point with a prescribed path difference, found by bisection along a vertical
 * line at distance `x`. Test scaffolding only.
 *
 * Note the direction: source A sits at +d/2, so moving up shortens r1 and the
 * path difference r1 - r2 *decreases* with y, from +d far below to -d far above.
 */
function pointWithPathDifference(dr: number, separation: number, x = 0.8) {
  let low = -400; // path difference here is close to +separation
  let high = 400; // ...and close to -separation
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2;
    if (pathDifference(x, mid, separation) > dr) low = mid;
    else high = mid;
  }
  return { x, y: (low + high) / 2 };
}
