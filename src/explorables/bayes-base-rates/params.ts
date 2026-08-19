import type { ParamSchema } from '../../engine/params';

export const schema = [
  {
    kind: 'continuous',
    id: 'prevalence',
    label: 'How common the condition is',
    min: 0.0001,
    max: 0.5,
    step: 0.0001,
    default: 0.01,
    scale: 'log',
    format: (v: number) => (v >= 0.01 ? `${(v * 100).toFixed(1)}%` : `1 in ${Math.round(1 / v)}`),
  },
  {
    kind: 'continuous',
    id: 'sensitivity',
    label: 'Sensitivity',
    min: 0.5,
    max: 1,
    step: 0.005,
    default: 0.99,
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
  },
  {
    kind: 'continuous',
    id: 'specificity',
    label: 'Specificity',
    min: 0.5,
    max: 1,
    step: 0.005,
    default: 0.95,
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
  },
  {
    kind: 'discrete',
    id: 'tests',
    label: 'Consecutive positives',
    options: [
      { value: '1', label: 'One' },
      { value: '2', label: 'Two' },
      { value: '3', label: 'Three' },
    ],
    default: '1',
  },
  {
    kind: 'toggle',
    id: 'only_positives',
    label: 'Show only the people who tested positive',
    default: false,
    hint: 'Drops everyone the test cleared, which is the group a positive result puts you in.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
