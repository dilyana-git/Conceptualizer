import type { ParamSchema } from '../../engine/params';

export const schema = [
  {
    kind: 'discrete',
    id: 'parent',
    label: 'What you are sampling from',
    options: [
      { value: 'uniform', label: 'Uniform' },
      { value: 'exponential', label: 'Exponential' },
      { value: 'bimodal', label: 'Two humps' },
      { value: 'lognormal', label: 'Lognormal' },
    ],
    default: 'exponential',
  },
  {
    kind: 'continuous',
    id: 'sampleSize',
    label: 'Observations per mean',
    symbol: 'n',
    min: 1,
    max: 60,
    step: 1,
    default: 5,
  },
  {
    kind: 'continuous',
    id: 'draws',
    label: 'How many means to draw',
    min: 200,
    max: 5000,
    step: 100,
    default: 2000,
  },
  {
    kind: 'continuous',
    id: 'bins',
    label: 'Histogram bins',
    min: 12,
    max: 60,
    step: 2,
    default: 32,
  },
  {
    kind: 'continuous',
    id: 'sample',
    label: 'Redraw',
    min: 1,
    max: 20,
    step: 1,
    default: 1,
    format: (v: number) => `#${v.toFixed(0)}`,
  },
  {
    kind: 'toggle',
    id: 'show_normal',
    label: 'Overlay the predicted normal',
    default: true,
    hint: 'Centred on the parent mean, with spread sigma over root n.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
