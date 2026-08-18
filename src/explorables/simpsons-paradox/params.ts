import type { ParamSchema } from '../../engine/params';

export const schema = [
  {
    kind: 'continuous',
    id: 'groups',
    label: 'Number of groups',
    symbol: 'k',
    min: 2,
    max: 5,
    step: 1,
    default: 3,
    format: (v: number) => v.toFixed(0),
  },
  {
    kind: 'continuous',
    id: 'separation',
    label: 'Separation between groups',
    min: 0,
    max: 4,
    step: 0.1,
    default: 2,
  },
  {
    kind: 'continuous',
    id: 'shift',
    label: 'Vertical offset per group',
    min: -4,
    max: 2,
    step: 0.1,
    default: -2.2,
  },
  {
    kind: 'continuous',
    id: 'within',
    label: 'Trend inside each group',
    min: -1,
    max: 2,
    step: 0.1,
    default: 1,
  },
  {
    kind: 'continuous',
    id: 'noise',
    label: 'Scatter',
    min: 0,
    max: 1.2,
    step: 0.05,
    default: 0.4,
  },
  {
    kind: 'toggle',
    id: 'show_pooled',
    label: 'Fit one line to everything',
    default: true,
    hint: 'The line you get by ignoring the grouping.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
