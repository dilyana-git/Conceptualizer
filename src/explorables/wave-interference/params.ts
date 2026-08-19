import type { ParamSchema } from '../../engine/params';

export const schema = [
  {
    kind: 'continuous',
    id: 'separation',
    label: 'Source separation',
    symbol: 'd',
    min: 0.02,
    max: 1.2,
    step: 0.02,
    default: 0.5,
  },
  {
    kind: 'continuous',
    id: 'wavelength',
    label: 'Wavelength',
    symbol: '\\lambda',
    min: 0.03,
    max: 0.5,
    step: 0.005,
    scale: 'log',
    default: 0.12,
    format: (v: number) => v.toFixed(3),
  },
  {
    kind: 'continuous',
    id: 'phase',
    label: 'Phase offset',
    symbol: '\\varphi',
    min: 0,
    max: 6.28,
    step: 0.02,
    default: 0,
    format: (v: number) => `${(v / Math.PI).toFixed(2)}π`,
  },
  {
    kind: 'discrete',
    id: 'mode',
    label: 'What to show',
    options: [
      { value: 'intensity', label: 'Time-averaged' },
      { value: 'amplitude', label: 'Live wave' },
    ],
    default: 'intensity',
  },
  {
    kind: 'toggle',
    id: 'show_rays',
    label: 'Mark the cancellation directions',
    default: false,
    hint: 'Rays at the angles where d·sin(θ) hits a half-wavelength.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
