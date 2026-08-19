/**
 * Gradient descent — PURE module. SPEC §3.3. No React, no DOM, no rAF: the
 * whole trajectory is a function of the parameters, so the same settings always
 * draw the same path and a shared link reproduces it exactly.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13)
 * ---------------------------------------------------------------------------
 * Heavy-ball descent (Polyak, 1964):
 *
 *     v_{t+1} = beta * v_t - lr * grad f(p_t)
 *     p_{t+1} = p_t + v_{t+1}
 *
 * With beta = 0 this is plain gradient descent, p_{t+1} = p_t - lr * grad f.
 *
 * On a quadratic f(x) = a x^2 the gradient is 2 a x, so one plain step is
 *
 *     x_{t+1} = x_t (1 - 2 a lr)
 *
 * which is a geometric sequence. It converges exactly when |1 - 2 a lr| < 1,
 * that is when
 *
 *     0 < lr < 1 / a
 *
 * and the error after t steps is |1 - 2 a lr|^t |x_0|, exactly. In more than one
 * dimension the same condition has to hold in every direction at once, so the
 * *largest* curvature sets the maximum usable step while the *smallest* sets how
 * slowly the whole thing converges. Their ratio is the condition number, and it
 * is the entire reason the 'ravine' surface below is hard.
 *
 * Surfaces:
 *   bowl    f = x^2 + y^2                  curvature 2 and 2      kappa = 1
 *   ravine  f = 0.05 x^2 + 2 y^2           curvature 0.1 and 4    kappa = 40
 *   double  f = (x^2 - 1)^2 + y^2          two minima at (+-1, 0), saddle at origin
 * ---------------------------------------------------------------------------
 */

export type SurfaceKey = 'bowl' | 'ravine' | 'double';

export interface Surface {
  key: SurfaceKey;
  label: string;
  f: (x: number, y: number) => number;
  grad: (x: number, y: number) => [number, number];
  /** Quadratic coefficients where they exist, for the stability threshold. */
  curvature: readonly [number, number] | null;
  minima: readonly { x: number; y: number }[];
}

export const SURFACES: Record<SurfaceKey, Surface> = {
  bowl: {
    key: 'bowl',
    label: 'Round bowl',
    f: (x, y) => x * x + y * y,
    grad: (x, y) => [2 * x, 2 * y],
    curvature: [1, 1],
    minima: [{ x: 0, y: 0 }],
  },
  ravine: {
    key: 'ravine',
    label: 'Narrow ravine',
    f: (x, y) => 0.05 * x * x + 2 * y * y,
    grad: (x, y) => [0.1 * x, 4 * y],
    curvature: [0.05, 2],
    minima: [{ x: 0, y: 0 }],
  },
  double: {
    key: 'double',
    label: 'Two valleys',
    f: (x, y) => (x * x - 1) ** 2 + y * y,
    grad: (x, y) => [4 * x * (x * x - 1), 2 * y],
    curvature: null,
    minima: [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ],
  },
};

/** Radius of the ring the starting point is chosen from. */
export const START_RADIUS = 1.9;
export const DOMAIN: readonly [number, number] = [-2.4, 2.4];

/** Anything past this is treated as gone, not merely large. */
const DIVERGENCE_LIMIT = 1e6;

export interface DescentInputs {
  surface: SurfaceKey;
  learningRate: number;
  momentum: number;
  /** Where on the starting ring to begin, in degrees. */
  startAngle: number;
  steps: number;
}

export interface DescentOutcome {
  surface: Surface;
  path: { x: number; y: number; loss: number }[];
  start: { x: number; y: number };
  final: { x: number; y: number };
  finalLoss: number;
  startLoss: number;
  diverged: boolean;
  /** Steps actually taken before divergence cut it short. */
  stepsTaken: number;
  /**
   * Largest learning rate that converges, where the surface is quadratic.
   * Null for the non-quadratic surface, where no single number governs it.
   */
  stabilityThreshold: number | null;
  /** Ratio of largest to smallest curvature; null when not quadratic. */
  conditionNumber: number | null;
  /** Which minimum it settled into, if any. */
  settledOn: number | null;
}

export function startPoint(angleDegrees: number): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return { x: START_RADIUS * Math.cos(radians), y: START_RADIUS * Math.sin(radians) };
}

/** Largest stable learning rate: 1 / (largest quadratic coefficient). */
export function stabilityThreshold(surface: Surface): number | null {
  if (!surface.curvature) return null;
  return 1 / Math.max(...surface.curvature);
}

export function conditionNumber(surface: Surface): number | null {
  if (!surface.curvature) return null;
  return Math.max(...surface.curvature) / Math.min(...surface.curvature);
}

export function solve(inputs: DescentInputs): DescentOutcome {
  const surface = SURFACES[inputs.surface];
  const start = startPoint(inputs.startAngle);

  let x = start.x;
  let y = start.y;
  let vx = 0;
  let vy = 0;

  const path = [{ x, y, loss: surface.f(x, y) }];
  let diverged = false;

  for (let step = 0; step < inputs.steps; step++) {
    const [gx, gy] = surface.grad(x, y);
    vx = inputs.momentum * vx - inputs.learningRate * gx;
    vy = inputs.momentum * vy - inputs.learningRate * gy;
    x += vx;
    y += vy;

    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) > DIVERGENCE_LIMIT) {
      diverged = true;
      break;
    }
    path.push({ x, y, loss: surface.f(x, y) });
  }

  const last = path[path.length - 1]!;

  // Which basin it ended in, if it is genuinely close to one.
  let settledOn: number | null = null;
  if (!diverged) {
    for (let i = 0; i < surface.minima.length; i++) {
      const m = surface.minima[i]!;
      if (Math.hypot(last.x - m.x, last.y - m.y) < 0.05) settledOn = i;
    }
  }

  return {
    surface,
    path,
    start,
    final: { x: last.x, y: last.y },
    finalLoss: last.loss,
    startLoss: path[0]!.loss,
    diverged,
    stepsTaken: path.length - 1,
    stabilityThreshold: stabilityThreshold(surface),
    conditionNumber: conditionNumber(surface),
    settledOn,
  };
}

/**
 * Loss sampled on a square grid, for the per-pixel field.
 *
 * Returned as a flat Float32Array in row-major order with y increasing
 * downward, which is the order the canvas wants to write pixels in.
 */
export function lossField(surface: Surface, resolution: number): Float32Array {
  const [lo, hi] = DOMAIN;
  const span = hi - lo;
  const out = new Float32Array(resolution * resolution);
  for (let row = 0; row < resolution; row++) {
    // Row 0 is the top of the image, which is the *largest* y.
    const y = hi - (span * (row + 0.5)) / resolution;
    for (let col = 0; col < resolution; col++) {
      const x = lo + (span * (col + 0.5)) / resolution;
      out[row * resolution + col] = surface.f(x, y);
    }
  }
  return out;
}

/** Contour levels spaced so the bands read evenly on a square-root ramp. */
export function contourLevels(surface: Surface, count = 9): number[] {
  const [lo, hi] = DOMAIN;
  let max = 0;
  for (const cx of [lo, 0, hi]) {
    for (const cy of [lo, 0, hi]) max = Math.max(max, surface.f(cx, cy));
  }
  return Array.from({ length: count }, (_, i) => max * ((i + 1) / count) ** 2);
}

/** §9: what the field currently shows. */
export function describe(inputs: DescentInputs, outcome: DescentOutcome): string {
  const settings =
    `Learning rate ${inputs.learningRate.toFixed(3)}` +
    (inputs.momentum > 0 ? `, momentum ${inputs.momentum.toFixed(2)}` : ', no momentum') +
    `, on the ${outcome.surface.label.toLowerCase()}.`;

  const where =
    `${settings} Starting at (${outcome.start.x.toFixed(2)}, ${outcome.start.y.toFixed(2)}) ` +
    `with loss ${outcome.startLoss.toFixed(3)}.`;

  if (outcome.diverged) {
    return (
      `${where} The step size is too large: the path blew up after ` +
      `${outcome.stepsTaken} steps instead of settling.` +
      (outcome.stabilityThreshold
        ? ` Anything at or above ${outcome.stabilityThreshold.toFixed(2)} diverges here.`
        : '')
    );
  }

  const settled =
    outcome.settledOn === null
      ? 'has not reached a minimum'
      : `settled into the minimum at (${outcome.surface.minima[outcome.settledOn]!.x}, ` +
        `${outcome.surface.minima[outcome.settledOn]!.y})`;

  return (
    `${where} After ${outcome.stepsTaken} steps the loss is ` +
    `${outcome.finalLoss.toFixed(4)} and the path ${settled}.`
  );
}
