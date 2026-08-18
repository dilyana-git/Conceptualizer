import type { ParamSchema } from '../../engine/params';

export const schema = [
  {
    kind: 'continuous',
    id: 'effect',
    label: 'True effect size',
    symbol: 'd',
    min: 0,
    max: 1.2,
    step: 0.05,
    default: 0.3,
  },
  {
    kind: 'continuous',
    id: 'n',
    label: 'Sample size per group',
    symbol: 'n',
    min: 5,
    max: 500,
    step: 1,
    default: 30,
    scale: 'log',
  },
  {
    kind: 'continuous',
    id: 'alpha',
    label: 'Significance level',
    symbol: '\\alpha',
    min: 0.001,
    max: 0.2,
    step: 0.001,
    default: 0.05,
    scale: 'log',
    format: (v: number) => v.toFixed(3),
  },
  {
    kind: 'discrete',
    id: 'tails',
    label: 'Test',
    options: [
      { value: 'two', label: 'Two-tailed' },
      { value: 'one', label: 'One-tailed' },
    ],
    default: 'two',
  },
  {
    kind: 'toggle',
    id: 'show_typem',
    label: 'Show what a significant result would report',
    default: false,
    hint: 'The average magnitude among significant studies, against the truth.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
