import type { ParamSchema } from '../../engine/params';

export const schema = [
  {
    kind: 'discrete',
    id: 'surface',
    label: 'Surface',
    options: [
      { value: 'bowl', label: 'Round bowl' },
      { value: 'ravine', label: 'Narrow ravine' },
      { value: 'double', label: 'Two valleys' },
    ],
    default: 'bowl',
  },
  {
    kind: 'continuous',
    id: 'learningRate',
    label: 'Learning rate',
    symbol: '\\eta',
    min: 0.005,
    max: 2,
    step: 0.005,
    default: 0.1,
    scale: 'log',
    format: (v: number) => v.toFixed(3),
  },
  {
    kind: 'continuous',
    id: 'momentum',
    label: 'Momentum',
    symbol: '\\beta',
    min: 0,
    max: 0.95,
    step: 0.05,
    default: 0,
  },
  {
    kind: 'continuous',
    id: 'startAngle',
    label: 'Where to start',
    unit: '°',
    min: 0,
    max: 350,
    step: 10,
    default: 210,
  },
  {
    kind: 'continuous',
    id: 'steps',
    label: 'Steps taken',
    min: 1,
    max: 300,
    step: 1,
    default: 60,
  },
  {
    kind: 'toggle',
    id: 'show_field',
    label: 'Shade the loss surface',
    default: true,
    hint: 'Darker is higher. Bands are contours of equal loss.',
  },
] as const satisfies ParamSchema;

export type Schema = typeof schema;
