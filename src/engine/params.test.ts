import { describe, expect, it } from 'vitest';
import {
  MAX_PARAMS,
  SchemaError,
  coerce,
  decodeParams,
  defaultsOf,
  encodeParams,
  isDirtyAgainst,
  quantise,
  validateSchema,
  type ParamSchema,
} from './params';

const schema = [
  {
    kind: 'continuous',
    id: 'alpha',
    label: 'Alpha',
    min: 0,
    max: 10,
    step: 0.5,
    default: 2,
  },
  {
    kind: 'continuous',
    id: 'freq',
    label: 'Frequency',
    min: 1,
    max: 1000,
    step: 1,
    default: 10,
    scale: 'log',
  },
  {
    kind: 'discrete',
    id: 'mode',
    label: 'Mode',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
    default: 'a',
  },
  { kind: 'toggle', id: 'grid', label: 'Grid', default: true },
] as const satisfies ParamSchema;

describe('schema validation', () => {
  it('accepts a well-formed schema', () => {
    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('rejects more than six parameters (§4 cap)', () => {
    const tooMany = Array.from({ length: MAX_PARAMS + 1 }, (_, i) => ({
      kind: 'toggle' as const,
      id: `t${i}`,
      label: `T${i}`,
      default: false,
    }));
    expect(() => validateSchema(tooMany)).toThrow(SchemaError);
  });

  it('rejects duplicate ids, bad ranges, and out-of-range defaults', () => {
    expect(() =>
      validateSchema([
        { kind: 'toggle', id: 'x', label: 'X', default: false },
        { kind: 'toggle', id: 'x', label: 'X again', default: true },
      ]),
    ).toThrow(/Duplicate/);

    expect(() =>
      validateSchema([
        { kind: 'continuous', id: 'y', label: 'Y', min: 5, max: 1, step: 1, default: 2 },
      ]),
    ).toThrow(/min must be less than max/);

    expect(() =>
      validateSchema([
        { kind: 'continuous', id: 'z', label: 'Z', min: 0, max: 10, step: 1, default: 99 },
      ]),
    ).toThrow(/outside/);

    expect(() =>
      validateSchema([
        { kind: 'continuous', id: 'l', label: 'L', min: 0, max: 10, step: 1, default: 1, scale: 'log' },
      ]),
    ).toThrow(/log scale/);

    expect(() =>
      validateSchema([
        { kind: 'discrete', id: 'd', label: 'D', options: [{ value: 'a', label: 'A' }], default: 'q' },
      ]),
    ).toThrow(/not one of the options/);
  });
});

describe('quantisation', () => {
  it('snaps to the step grid and clamps to range', () => {
    const spec = schema[0];
    expect(quantise(spec, 2.3)).toBe(2.5);
    expect(quantise(spec, 2.2)).toBe(2);
    expect(quantise(spec, -5)).toBe(0);
    expect(quantise(spec, 99)).toBe(10);
  });

  it('does not leak float drift into the value', () => {
    const spec = {
      kind: 'continuous',
      id: 'e',
      label: 'E',
      min: 0.2,
      max: 3,
      step: 0.05,
      default: 1,
    } as const;
    // 0.2 + 3*0.05 in binary floating point is 0.35000000000000003
    expect(quantise(spec, 0.35)).toBe(0.35);
    expect(String(quantise(spec, 1.15))).toBe('1.15');
  });
});

describe('URL round-trip (§6)', () => {
  it('omits defaults so a clean URL stays clean', () => {
    expect(encodeParams(schema, defaultsOf(schema))).toBe('');
  });

  it('encodes only what differs from default, human-readably', () => {
    const values = { ...defaultsOf(schema), alpha: 4.5, mode: 'b' as const };
    const query = encodeParams(schema, values);
    expect(query).toContain('alpha=4.5');
    expect(query).toContain('mode=b');
    expect(query).not.toContain('freq=');
    expect(query).not.toContain('grid=');
    // §6: not compressed — legibility is worth the characters.
    expect(decodeURIComponent(query)).toBe(query);
  });

  it('round-trips every kind of parameter exactly', () => {
    const values = { alpha: 7.5, freq: 250, mode: 'b' as const, grid: false };
    const decoded = decodeParams(schema, `?${encodeParams(schema, values)}`);
    expect(decoded).toEqual(values);
  });

  it('clamps and validates on read, falling back silently rather than erroring', () => {
    const decoded = decodeParams(
      schema,
      '?alpha=999&freq=notanumber&mode=nonsense&grid=maybe&stray=1',
    );
    expect(decoded.alpha).toBe(10); // clamped to max
    expect(decoded.freq).toBe(10); // unparseable -> default
    expect(decoded.mode).toBe('a'); // not an option -> default
    expect(decoded.grid).toBe(true); // unrecognised -> default
    expect(decoded).not.toHaveProperty('stray');
  });

  it('accepts both spellings of a toggle', () => {
    const toggle = schema[3];
    expect(coerce(toggle, '1')).toBe(true);
    expect(coerce(toggle, 'true')).toBe(true);
    expect(coerce(toggle, '0')).toBe(false);
    expect(coerce(toggle, 'false')).toBe(false);
    expect(coerce(toggle, 'yes')).toBeUndefined();
  });

  it('snaps out-of-grid values from a hand-edited URL', () => {
    expect(decodeParams(schema, '?alpha=3.27').alpha).toBe(3.5);
  });
});

describe('dirtiness', () => {
  it('is clean at defaults and dirty after any change', () => {
    expect(isDirtyAgainst(schema, defaultsOf(schema))).toBe(false);
    expect(isDirtyAgainst(schema, { ...defaultsOf(schema), grid: false })).toBe(true);
  });
});
