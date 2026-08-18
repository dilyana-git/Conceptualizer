import type { ParamSchema } from '../../engine/params';

export const schema = [
  {
    kind: 'continuous',
    id: 'degree',
    label: 'Model flexibility (polynomial degree)',
    symbol: 'd',
    min: 0,
    max: 9,
    step: 1,
    default: 3,
    format: (v: number) => v.toFixed(0),
  },
  {
    kind: 'continuous',
    id: 'trainSize',
    label: 'Training points',
    symbol: 'n',
    min: 6,
    max: 60,
    step: 1,
    default: 20,
    format: (v: number) => v.toFixed(0),
  },
  {
    kind: 'continuous',
    id: 'noise',
    label: 'Noise',
    symbol: '\\sigma',
    min: 0,
    max: 0.5,
    step: 0.02,
    default: 0.2,
  },
  {
    kind: 'continuous',
    id: 'resamples',
    label: 'Training sets drawn',
    min: 1,
    max: 60,
    step: 1,
    default: 30,
    format: (v: number) => v.toFixed(0),
  },
  {
    kind: 'toggle',
    id: 'show_average',
    label: 'Show the average fit',
    default: true,
    hint: 'Its distance from the truth is the bias.',
  },
  {
    kind: 'toggle',
    id: 'show_points',
    label: 'Show one training set',
    default: false,
    hint: 'The points a single draw would actually see.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
