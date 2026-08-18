import type { ParamSchema } from '../../engine/params';

/**
 * §4: six parameters is the cap, and this uses all six deliberately —
 * two elasticities, the tax, the statutory side, and two reveal toggles.
 * Anything further belongs in a second explorable.
 */
export const schema = [
  {
    kind: 'continuous',
    id: 'elasticity_d',
    label: 'Elasticity of demand',
    symbol: '\\varepsilon_d',
    min: 0.2,
    max: 3,
    step: 0.05,
    default: 1,
  },
  {
    kind: 'continuous',
    id: 'elasticity_s',
    label: 'Elasticity of supply',
    symbol: '\\varepsilon_s',
    min: 0.2,
    max: 3,
    step: 0.05,
    default: 1,
  },
  {
    kind: 'continuous',
    id: 'tax',
    label: 'Tax per unit',
    symbol: 't',
    unit: '$',
    min: 0,
    max: 6,
    step: 0.1,
    default: 2,
  },
  {
    kind: 'discrete',
    id: 'levied_on',
    label: 'Tax collected from',
    options: [
      { value: 'sellers', label: 'Sellers' },
      { value: 'buyers', label: 'Buyers' },
    ],
    default: 'sellers',
  },
  {
    kind: 'toggle',
    id: 'show_surplus',
    label: 'Shade consumer and producer surplus',
    default: false,
    hint: 'Shows who keeps what is left of the gains from trade.',
  },
  {
    kind: 'toggle',
    id: 'show_dwl',
    label: 'Highlight deadweight loss',
    default: true,
    hint: 'The trades that stop happening because of the tax.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
