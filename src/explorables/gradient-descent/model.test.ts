import { describe, expect, it } from 'vitest';
import {
  DOMAIN,
  SURFACES,
  START_RADIUS,
  conditionNumber,
  contourLevels,
  lossField,
  solve,
  stabilityThreshold,
  startPoint,
  type DescentInputs,
} from './model';

const base: DescentInputs = {
  surface: 'bowl',
  learningRate: 0.1,
  momentum: 0,
  startAngle: 210,
  steps: 60,
};

describe('the surfaces are what the comments claim', () => {
  it('puts a minimum where each surface says its minimum is', () => {
    for (const surface of Object.values(SURFACES)) {
      for (const m of surface.minima) {
        const here = surface.f(m.x, m.y);
        // Every nearby point must be at least as high.
        for (const [dx, dy] of [
          [0.01, 0],
          [-0.01, 0],
          [0, 0.01],
          [0, -0.01],
        ]) {
          expect(surface.f(m.x + dx!, m.y + dy!)).toBeGreaterThanOrEqual(here - 1e-12);
        }
        // And the gradient vanishes there.
        const [gx, gy] = surface.grad(m.x, m.y);
        expect(Math.abs(gx)).toBeLessThan(1e-9);
        expect(Math.abs(gy)).toBeLessThan(1e-9);
      }
    }
  });

  it('has gradients that match finite differences of its own f', () => {
    const h = 1e-6;
    for (const surface of Object.values(SURFACES)) {
      for (const [x, y] of [
        [0.7, -1.1],
        [-1.6, 0.4],
        [2.0, 2.0],
      ]) {
        const [gx, gy] = surface.grad(x!, y!);
        const numX = (surface.f(x! + h, y!) - surface.f(x! - h, y!)) / (2 * h);
        const numY = (surface.f(x!, y! + h) - surface.f(x!, y! - h)) / (2 * h);
        expect(gx).toBeCloseTo(numX, 4);
        expect(gy).toBeCloseTo(numY, 4);
      }
    }
  });

  it('reports the condition numbers the comments state', () => {
    expect(conditionNumber(SURFACES.bowl)).toBeCloseTo(1, 12);
    expect(conditionNumber(SURFACES.ravine)).toBeCloseTo(40, 12);
    expect(conditionNumber(SURFACES.double)).toBeNull();
  });

  it('starts on the stated ring', () => {
    for (const angle of [0, 90, 210, 355]) {
      const p = startPoint(angle);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(START_RADIUS, 12);
    }
  });
});

describe('the stability threshold is exactly 1 / curvature', () => {
  it('converges just below the threshold and diverges just above it', () => {
    for (const key of ['bowl', 'ravine'] as const) {
      const threshold = stabilityThreshold(SURFACES[key])!;

      const stable = solve({ ...base, surface: key, learningRate: threshold * 0.95, steps: 400 });
      expect(stable.diverged).toBe(false);
      expect(stable.finalLoss).toBeLessThan(stable.startLoss);

      const unstable = solve({ ...base, surface: key, learningRate: threshold * 1.05, steps: 400 });
      expect(unstable.finalLoss).toBeGreaterThan(unstable.startLoss);
    }
  });

  it('gives the bowl a threshold of 1 and the ravine of 0.5', () => {
    expect(stabilityThreshold(SURFACES.bowl)).toBeCloseTo(1, 12);
    expect(stabilityThreshold(SURFACES.ravine)).toBeCloseTo(0.5, 12);
  });

  it('oscillates without growing at exactly the threshold', () => {
    // At lr = 1/a the multiplier is exactly -1: the iterate flips sign forever
    // and never shrinks. This is the knife edge the threshold names.
    const out = solve({ ...base, surface: 'bowl', learningRate: 1, steps: 40 });
    expect(out.diverged).toBe(false);
    for (const point of out.path) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(START_RADIUS, 8);
    }
  });
});

describe('convergence is geometric, at the rate the algebra predicts', () => {
  it('shrinks by exactly |1 - 2*a*lr| per step on a quadratic', () => {
    const learningRate = 0.15;
    const a = 1; // bowl
    const factor = Math.abs(1 - 2 * a * learningRate);
    const out = solve({ ...base, surface: 'bowl', learningRate, momentum: 0, steps: 30 });

    const r0 = Math.hypot(out.path[0]!.x, out.path[0]!.y);
    for (let t = 1; t < out.path.length; t++) {
      const rt = Math.hypot(out.path[t]!.x, out.path[t]!.y);
      expect(rt).toBeCloseTo(r0 * factor ** t, 9);
    }
  });

  it('makes a badly conditioned surface cost far more iterations', () => {
    // Each surface is given 90% of its own maximum stable step, and the same
    // number of iterations, starting the same distance out along the x axis.
    // The only difference is the condition number.
    const steps = 60;
    const bowl = solve({
      surface: 'bowl',
      learningRate: stabilityThreshold(SURFACES.bowl)! * 0.9,
      momentum: 0,
      startAngle: 0,
      steps,
    });
    const ravine = solve({
      surface: 'ravine',
      learningRate: stabilityThreshold(SURFACES.ravine)! * 0.9,
      momentum: 0,
      startAngle: 0,
      steps,
    });

    // The steep direction is done in both cases; the flat one is what lags.
    expect(Math.abs(ravine.final.y)).toBeLessThan(1e-9);

    // The round bowl has essentially arrived. The ravine is still a tenth of
    // the way out, four orders of magnitude behind, because its usable step is
    // set by the steep direction while its progress is set by the flat one.
    expect(Math.abs(bowl.final.x)).toBeLessThan(1e-4);
    expect(Math.abs(ravine.final.x)).toBeGreaterThan(0.05);
    expect(Math.abs(ravine.final.x) / Math.abs(bowl.final.x)).toBeGreaterThan(1e4);
  });

  it('lets momentum cross the ravine far faster than plain descent', () => {
    const lr = 0.4;
    const plain = solve({ surface: 'ravine', learningRate: lr, momentum: 0, startAngle: 0, steps: 200 });
    const heavy = solve({ surface: 'ravine', learningRate: lr, momentum: 0.9, startAngle: 0, steps: 200 });
    expect(heavy.finalLoss).toBeLessThan(plain.finalLoss / 10);
  });
});

describe('local minima', () => {
  it('settles into whichever valley it started nearest', () => {
    // startAngle 0 puts it at x = +1.9; 180 puts it at x = -1.9.
    const right = solve({ surface: 'double', learningRate: 0.05, momentum: 0, startAngle: 0, steps: 400 });
    const left = solve({ surface: 'double', learningRate: 0.05, momentum: 0, startAngle: 180, steps: 400 });

    expect(right.settledOn).toBe(1);
    expect(right.final.x).toBeCloseTo(1, 3);
    expect(left.settledOn).toBe(0);
    expect(left.final.x).toBeCloseTo(-1, 3);
  });

  it('finds no single stability threshold where curvature is not constant', () => {
    const out = solve({ ...base, surface: 'double' });
    expect(out.stabilityThreshold).toBeNull();
    expect(out.conditionNumber).toBeNull();
  });

  it('can be thrown into the other valley by enough momentum', () => {
    const gentle = solve({ surface: 'double', learningRate: 0.05, momentum: 0, startAngle: 0, steps: 300 });
    const violent = solve({ surface: 'double', learningRate: 0.05, momentum: 0.95, startAngle: 0, steps: 300 });
    expect(gentle.settledOn).toBe(1);
    // Momentum carries it over the ridge at the origin at least once.
    expect(violent.path.some((p) => p.x < -0.2)).toBe(true);
  });
});

describe('divergence is reported, not silently returned', () => {
  it('flags a blow-up and stops early', () => {
    const out = solve({ ...base, surface: 'bowl', learningRate: 1.8, steps: 500 });
    expect(out.diverged).toBe(true);
    expect(out.stepsTaken).toBeLessThan(500);
    expect(out.settledOn).toBeNull();
    expect(Number.isFinite(out.finalLoss)).toBe(true);
  });

  it('never emits a non-finite coordinate in the path', () => {
    for (const learningRate of [0.001, 0.5, 1.5, 2]) {
      for (const surface of ['bowl', 'ravine', 'double'] as const) {
        const out = solve({ ...base, surface, learningRate, momentum: 0.9, steps: 200 });
        for (const p of out.path) {
          expect(Number.isFinite(p.x)).toBe(true);
          expect(Number.isFinite(p.y)).toBe(true);
          expect(Number.isFinite(p.loss)).toBe(true);
        }
      }
    }
  });
});

describe('the loss field', () => {
  it('samples the surface in row-major order with y increasing upward', () => {
    const resolution = 8;
    const field = lossField(SURFACES.bowl, resolution);
    expect(field).toHaveLength(resolution * resolution);

    const [lo, hi] = DOMAIN;
    const span = hi - lo;
    for (const [row, col] of [
      [0, 0],
      [3, 5],
      [7, 7],
    ]) {
      const y = hi - (span * (row! + 0.5)) / resolution;
      const x = lo + (span * (col! + 0.5)) / resolution;
      expect(field[row! * resolution + col!]).toBeCloseTo(SURFACES.bowl.f(x, y), 5);
    }
  });

  it('is lowest at the middle of the bowl and highest at the corners', () => {
    const resolution = 32;
    const field = lossField(SURFACES.bowl, resolution);
    const middle = field[(resolution / 2) * resolution + resolution / 2]!;
    expect(middle).toBeLessThan(field[0]!);
    expect(middle).toBeLessThan(field[field.length - 1]!);
  });

  it('produces increasing contour levels', () => {
    for (const surface of Object.values(SURFACES)) {
      const levels = contourLevels(surface);
      expect(levels.length).toBeGreaterThan(1);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i]!).toBeGreaterThan(levels[i - 1]!);
      }
    }
  });
});
