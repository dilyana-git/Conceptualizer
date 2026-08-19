/**
 * The parameter schema — SPEC §4.
 *
 * Every explorable declares its parameters exactly once. That declaration drives
 * the control panel, the URL serialisation, keyboard interaction, equation
 * binding, and reset. Authors never hand-write a slider.
 *
 * §13: if the schema cannot express something an explorable needs, extend the
 * schema here — do not let an explorable reach around it.
 */

export interface ContinuousParam {
  readonly kind: 'continuous';
  readonly id: string;
  readonly label: string;
  /** LaTeX symbol for equation binding (§2.3), e.g. "k". */
  readonly symbol?: string;
  readonly unit?: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  readonly scale?: 'linear' | 'log';
  readonly format?: (v: number) => string;
}

export interface DiscreteParam {
  readonly kind: 'discrete';
  readonly id: string;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly default: string;
}

export interface ToggleParam {
  readonly kind: 'toggle';
  readonly id: string;
  readonly label: string;
  readonly default: boolean;
  /** What turning it on reveals. */
  readonly hint?: string;
}

export type ParamSpec = ContinuousParam | DiscreteParam | ToggleParam;
export type ParamSchema = readonly ParamSpec[];

/** Maps a single spec to the type of its value. */
type ValueOf<P extends ParamSpec> = P extends ContinuousParam
  ? number
  : P extends DiscreteParam
    ? string
    : boolean;

/**
 * Inferred value map. Requires the schema be declared `as const` (or with
 * `satisfies ParamSchema`) so `id` stays a literal type.
 */
export type ParamValues<S extends ParamSchema> = {
  -readonly [P in S[number] as P['id']]: ValueOf<P>;
};

/** §4: more than six and the reader is fiddling, not reasoning. */
export const MAX_PARAMS = 6;

export class SchemaError extends Error {}

/**
 * Validates a schema at module load. Throws rather than warns: an over-stuffed
 * or duplicated schema is an authoring bug that should fail the build, not
 * degrade quietly at runtime.
 */
export function validateSchema(schema: ParamSchema): void {
  if (schema.length > MAX_PARAMS) {
    throw new SchemaError(
      `A schema may declare at most ${MAX_PARAMS} parameters (got ${schema.length}). ` +
        'If the model needs more, it is two explorables. See SPEC §4.',
    );
  }
  const seen = new Set<string>();
  for (const spec of schema) {
    if (seen.has(spec.id)) throw new SchemaError(`Duplicate parameter id "${spec.id}".`);
    seen.add(spec.id);

    if (spec.kind === 'continuous') {
      if (!(spec.min < spec.max)) {
        throw new SchemaError(`Parameter "${spec.id}": min must be less than max.`);
      }
      if (!(spec.step > 0)) {
        throw new SchemaError(`Parameter "${spec.id}": step must be positive.`);
      }
      if (spec.scale === 'log' && spec.min <= 0) {
        throw new SchemaError(`Parameter "${spec.id}": log scale requires min > 0.`);
      }
      if (spec.default < spec.min || spec.default > spec.max) {
        throw new SchemaError(`Parameter "${spec.id}": default lies outside [min, max].`);
      }
    }

    if (spec.kind === 'discrete') {
      if (spec.options.length === 0) {
        throw new SchemaError(`Parameter "${spec.id}": discrete params need options.`);
      }
      if (!spec.options.some((o) => o.value === spec.default)) {
        throw new SchemaError(`Parameter "${spec.id}": default is not one of the options.`);
      }
    }
  }
}

export function defaultsOf<S extends ParamSchema>(schema: S): ParamValues<S> {
  const out: Record<string, number | string | boolean> = {};
  for (const spec of schema) out[spec.id] = spec.default;
  return out as ParamValues<S>;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Significant figures kept for log-scale parameters.
 *
 * Four resolves adjacent slider positions across four decades: with 1000
 * positions spanning a factor of 5000, neighbours differ by 0.85%, comfortably
 * above the 0.1% that four figures distinguishes.
 */
export const LOG_SIGNIFICANT_DIGITS = 4;

/** Rounds to `digits` significant figures. */
export function toSignificantFigures(v: number, digits: number): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  const magnitude = Math.ceil(Math.log10(Math.abs(v)));
  const factor = 10 ** (digits - magnitude);
  return Math.round(v * factor) / factor;
}

/**
 * Snaps a value to the granularity its scale implies, then clamps.
 *
 * Linear parameters snap to the spec's step grid, anchored at `min`.
 *
 * Log parameters do NOT: an absolute step is the wrong granularity for a log
 * scale by construction, because it is coarse at one end of the range and fine
 * at the other. Snapping a log slider to an absolute grid makes the control
 * genuinely stuck wherever the grid is coarser than the distance between
 * adjacent slider positions — the value rounds back to where it started and
 * neither dragging nor an arrow key can move it. Log parameters keep a fixed
 * number of significant figures instead, which is the same relative precision
 * everywhere. `step` still governs the linear case and still documents the
 * intended resolution.
 */
export function quantise(spec: ContinuousParam, v: number): number {
  if (spec.scale === 'log') {
    return clamp(toSignificantFigures(v, LOG_SIGNIFICANT_DIGITS), spec.min, spec.max);
  }
  const steps = Math.round((v - spec.min) / spec.step);
  const snapped = spec.min + steps * spec.step;
  // Re-round to kill float drift so readouts show 0.35, not 0.35000000000004.
  const decimals = decimalsFor(spec.step);
  return clamp(Number(snapped.toFixed(decimals)), spec.min, spec.max);
}

export function decimalsFor(step: number): number {
  if (!Number.isFinite(step)) return 0;
  const s = String(step);
  const dot = s.indexOf('.');
  if (dot === -1) return 0;
  return Math.min(s.length - dot - 1, 10);
}

/** Default readout formatting; a spec's own `format` wins over this. */
export function formatValue(spec: ContinuousParam, v: number): string {
  if (spec.format) return spec.format(v);
  // A log parameter has no fixed number of decimals that suits its whole range.
  if (spec.scale === 'log') return String(toSignificantFigures(v, LOG_SIGNIFICANT_DIGITS));
  return v.toFixed(decimalsFor(spec.step));
}

export function specById(schema: ParamSchema, id: string): ParamSpec | undefined {
  return schema.find((s) => s.id === id);
}

/**
 * Coerces one raw string from the URL into a valid value for `spec`.
 * Returns `undefined` when the input cannot be salvaged, so the caller can fall
 * back to the default. §6: invalid values fall back silently rather than error.
 */
export function coerce(spec: ParamSpec, raw: string): number | string | boolean | undefined {
  switch (spec.kind) {
    case 'continuous': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return undefined;
      return quantise(spec, n);
    }
    case 'discrete':
      return spec.options.some((o) => o.value === raw) ? raw : undefined;
    case 'toggle':
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
      return undefined;
  }
}

function serialise(spec: ParamSpec, value: number | string | boolean): string {
  if (spec.kind === 'toggle') return value ? '1' : '0';
  if (spec.kind === 'continuous' && typeof value === 'number') {
    // Log values are already at their full stored precision; rounding them to
    // the step's decimals here would silently lose it on every round trip.
    if (spec.scale === 'log') return String(value);
    return String(Number(value.toFixed(decimalsFor(spec.step))));
  }
  return String(value);
}

/** §6: read state from a query string, clamping and validating against the schema. */
export function decodeParams<S extends ParamSchema>(schema: S, search: string): ParamValues<S> {
  const values = defaultsOf(schema) as Record<string, number | string | boolean>;
  const query = new URLSearchParams(search);
  for (const spec of schema) {
    const raw = query.get(spec.id);
    if (raw === null) continue;
    const coerced = coerce(spec, raw);
    if (coerced !== undefined) values[spec.id] = coerced;
  }
  return values as ParamValues<S>;
}

/**
 * §6: `?<paramId>=<value>` for each param that differs from its default.
 * Defaults are omitted so a clean URL stays clean. Not compressed — legibility
 * is worth the characters.
 */
export function encodeParams<S extends ParamSchema>(schema: S, values: ParamValues<S>): string {
  const query = new URLSearchParams();
  const bag = values as Record<string, number | string | boolean>;
  for (const spec of schema) {
    const v = bag[spec.id];
    if (v === undefined || v === spec.default) continue;
    query.set(spec.id, serialise(spec, v));
  }
  return query.toString();
}

export function isDirtyAgainst<S extends ParamSchema>(schema: S, values: ParamValues<S>): boolean {
  const bag = values as Record<string, number | string | boolean>;
  return schema.some((spec) => bag[spec.id] !== spec.default);
}
