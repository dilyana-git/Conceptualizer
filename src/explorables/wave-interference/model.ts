/**
 * Two-source interference — PURE module. SPEC §3.3.
 *
 * ---------------------------------------------------------------------------
 * Source forms (§13)
 * ---------------------------------------------------------------------------
 * Two coherent point sources sit at (0, +d/2) and (0, -d/2), radiating with the
 * same wavelength and amplitude. Taking unit amplitude and no geometric decay —
 * see the Limits prose for what that costs — the displacement at a point is the
 * sum of the two arriving waves:
 *
 *     A(x, y, t) = cos(k r1 - wt) + cos(k r2 - wt + phi),     k = 2 pi / lambda
 *
 * Time-averaging the square of that gives the steady pattern the eye sees.
 * Using <cos^2> = 1/2 and the product-to-sum identity,
 *
 *     <A^2> = 1 + cos(k (r1 - r2) - phi)
 *
 * so defining intensity as twice the mean square,
 *
 *     I(x, y) = 4 cos^2( (k dr - phi) / 2 ),      dr = r1 - r2
 *
 * which is the familiar two-slit result: everything depends on the *path
 * difference* dr, and not otherwise on where the point is.
 *
 *   constructive   k dr - phi = 2 pi m    <=>   dr = m lambda + phi lambda / 2pi
 *   destructive    k dr - phi = (2m+1)pi  <=>   dr = (m + 1/2) lambda + phi lambda / 2pi
 *
 * Since |dr| <= d everywhere (triangle inequality, with equality only on the
 * axis through both sources), the number of dark bands is finite and set by the
 * ratio d / lambda. Far from the sources the curves of constant dr become
 * straight lines through the origin at angles satisfying
 *
 *     d sin(theta) = dr
 *
 * which is the grating equation, and the asymptotes drawn as rays here.
 * ---------------------------------------------------------------------------
 */

export type FieldMode = 'intensity' | 'amplitude';

/** Half-width of the square field, in the same units as separation. */
export const EXTENT = 1;

export interface WaveInputs {
  /** Distance between the two sources. */
  separation: number;
  wavelength: number;
  /** Phase lead of the second source, in radians. */
  phase: number;
  mode: FieldMode;
}

export interface SourcePositions {
  a: { x: number; y: number };
  b: { x: number; y: number };
}

export function sources(separation: number): SourcePositions {
  return { a: { x: 0, y: separation / 2 }, b: { x: 0, y: -separation / 2 } };
}

export function waveNumber(wavelength: number): number {
  return (2 * Math.PI) / wavelength;
}

/** Path difference r1 - r2 at a point. */
export function pathDifference(x: number, y: number, separation: number): number {
  const { a, b } = sources(separation);
  return Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y);
}

/**
 * Instantaneous displacement, in [-2, 2].
 * `t` is in periods, so t = 1 is one full cycle.
 */
export function amplitudeAt(
  x: number,
  y: number,
  inputs: WaveInputs,
  t: number,
): number {
  const { a, b } = sources(inputs.separation);
  const k = waveNumber(inputs.wavelength);
  const omegaT = 2 * Math.PI * t;
  const r1 = Math.hypot(x - a.x, y - a.y);
  const r2 = Math.hypot(x - b.x, y - b.y);
  return Math.cos(k * r1 - omegaT) + Math.cos(k * r2 - omegaT + inputs.phase);
}

/** Time-averaged intensity, in [0, 4]. */
export function intensityAt(x: number, y: number, inputs: WaveInputs): number {
  const k = waveNumber(inputs.wavelength);
  const dr = pathDifference(x, y, inputs.separation);
  const half = (k * dr - inputs.phase) / 2;
  return 4 * Math.cos(half) * Math.cos(half);
}

/**
 * Path differences of the destructive bands, those with |dr| <= separation.
 * The phase offset slides the whole family sideways.
 */
export function nodalPathDifferences(inputs: WaveInputs): number[] {
  const { separation, wavelength, phase } = inputs;
  const shift = (phase * wavelength) / (2 * Math.PI);
  const out: number[] = [];
  // |(m + 1/2) lambda + shift| <= separation bounds m on both sides.
  const lower = Math.ceil((-separation - shift) / wavelength - 0.5);
  const upper = Math.floor((separation - shift) / wavelength - 0.5);
  for (let m = lower; m <= upper; m++) out.push((m + 0.5) * wavelength + shift);
  return out;
}

/** Far-field directions of the dark bands, in radians from the x axis. */
export function nodalAngles(inputs: WaveInputs): number[] {
  const { separation } = inputs;
  if (separation === 0) return [];
  return nodalPathDifferences(inputs)
    .map((dr) => dr / separation)
    .filter((s) => Math.abs(s) <= 1)
    .map((s) => Math.asin(s));
}

export interface WaveOutcome {
  inputs: WaveInputs;
  sources: SourcePositions;
  /** Number of dark bands present anywhere in the pattern. */
  nodalCount: number;
  nodalAngles: number[];
  /** Intensity straight ahead, on the perpendicular bisector. */
  axisIntensity: number;
  /** separation / wavelength, the only ratio the pattern depends on. */
  ratio: number;
  /** Angular spacing of adjacent fringes far from the sources, in degrees. */
  fringeSpacingDegrees: number | null;
}

export function solve(inputs: WaveInputs): WaveOutcome {
  const angles = nodalAngles(inputs);
  const sorted = [...angles].sort((p, q) => p - q);

  let spacing: number | null = null;
  if (sorted.length >= 2) {
    let total = 0;
    for (let i = 1; i < sorted.length; i++) total += sorted[i]! - sorted[i - 1]!;
    spacing = ((total / (sorted.length - 1)) * 180) / Math.PI;
  }

  return {
    inputs,
    sources: sources(inputs.separation),
    nodalCount: angles.length,
    nodalAngles: sorted,
    axisIntensity: intensityAt(EXTENT, 0, inputs),
    ratio: inputs.separation / inputs.wavelength,
    fringeSpacingDegrees: spacing,
  };
}

/**
 * Fill a square grid of field values, row-major, y decreasing down the rows so
 * the buffer can be written straight into image pixels.
 *
 * §9 makes this the performance-critical path: it runs every frame in amplitude
 * mode. Writing into a caller-owned buffer keeps it allocation-free, and the
 * per-cell work is kept to two hypots and two cosines.
 */
export function fillField(
  out: Float32Array,
  resolution: number,
  inputs: WaveInputs,
  t: number,
): void {
  const { a, b } = sources(inputs.separation);
  const k = waveNumber(inputs.wavelength);
  const omegaT = 2 * Math.PI * t;
  const step = (2 * EXTENT) / resolution;
  const wantAmplitude = inputs.mode === 'amplitude';

  for (let row = 0; row < resolution; row++) {
    const y = EXTENT - step * (row + 0.5);
    const dya = y - a.y;
    const dyb = y - b.y;
    const rowOffset = row * resolution;

    for (let col = 0; col < resolution; col++) {
      const x = -EXTENT + step * (col + 0.5);
      const r1 = Math.sqrt(x * x + dya * dya);
      const r2 = Math.sqrt(x * x + dyb * dyb);

      if (wantAmplitude) {
        out[rowOffset + col] = Math.cos(k * r1 - omegaT) + Math.cos(k * r2 - omegaT + inputs.phase);
      } else {
        const half = (k * (r1 - r2) - inputs.phase) / 2;
        const c = Math.cos(half);
        out[rowOffset + col] = 4 * c * c;
      }
    }
  }
}

const deg = (radians: number) => `${((radians * 180) / Math.PI).toFixed(1)}°`;

/** §9: what the field currently shows. */
export function describe(outcome: WaveOutcome): string {
  const { inputs } = outcome;
  const centre =
    outcome.axisIntensity > 3.5
      ? 'Straight ahead the two waves fully reinforce'
      : outcome.axisIntensity < 0.5
        ? 'Straight ahead the two waves fully cancel'
        : 'Straight ahead the two waves partly cancel';

  const bands =
    outcome.nodalCount === 0
      ? 'There are no cancellation bands at all: the sources are closer together than half a ' +
        'wavelength.'
      : `There are ${outcome.nodalCount} bands of total cancellation, the outermost at ` +
        `${deg(Math.max(...outcome.nodalAngles.map(Math.abs)))} from the axis.`;

  return (
    `Two sources ${inputs.separation.toFixed(2)} apart, wavelength ` +
    `${inputs.wavelength.toFixed(3)}, a ratio of ${outcome.ratio.toFixed(1)}. ` +
    `${centre}. ${bands}` +
    (outcome.fringeSpacingDegrees === null
      ? ''
      : ` Adjacent cancellation lines are about ${outcome.fringeSpacingDegrees.toFixed(1)} degrees apart.`)
  );
}
