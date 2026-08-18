import type { ParamSchema } from '../../engine/params';

export const schema = [
  {
    kind: 'continuous',
    id: 'n',
    label: 'Cohort size',
    symbol: 'n',
    min: 20,
    max: 400,
    step: 10,
    default: 120,
  },
  {
    kind: 'continuous',
    id: 'median',
    label: 'True median survival',
    unit: 'mo',
    min: 4,
    max: 36,
    step: 1,
    default: 12,
  },
  {
    kind: 'continuous',
    id: 'censoring',
    label: 'Censored share',
    min: 0,
    max: 0.7,
    step: 0.05,
    default: 0.35,
    format: (v: number) => `${Math.round(v * 100)}%`,
  },
  {
    kind: 'continuous',
    id: 'sample',
    label: 'Dataset',
    min: 1,
    max: 30,
    step: 1,
    default: 1,
    format: (v: number) => `#${v.toFixed(0)}`,
  },
  {
    kind: 'discrete',
    id: 'comparator',
    label: 'Compare against',
    options: [
      { value: 'none', label: 'Nothing' },
      { value: 'drop', label: 'Discard censored' },
      { value: 'ignore', label: 'Censored = survivors' },
    ],
    default: 'none',
  },
  {
    kind: 'toggle',
    id: 'show_ci',
    label: 'Show 95% confidence band',
    default: false,
    hint: 'Greenwood limits. Watch them widen as the risk set empties.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
