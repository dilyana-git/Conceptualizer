/**
 * §5: the registry is a flat array. Adding an explorable is one folder plus one
 * import line — no CMS, no dynamic route generation, no MDX pipeline.
 *
 * Each explorable's `index.ts` re-exports exactly `meta`, `schema` and `View`,
 * which is the whole module contract, so a namespace import *is* the registry
 * entry. That keeps the cost of adding one to a single line.
 *
 * §13: no placeholder entries. An empty folder for a future concept is a
 * promise the codebase will not keep, so an explorable appears here only when
 * it is actually built.
 */
import type { ComponentType, ReactNode } from 'react';
import type { ExplorableMeta } from './engine/meta';
import type { ParamSchema } from './engine/params';
import type { ParamApi } from './engine/useParams';

import * as taxIncidence from './explorables/tax-incidence';
import * as waveInterference from './explorables/wave-interference';
import * as survivalAnalysis from './explorables/survival-analysis';
import * as statisticalPower from './explorables/statistical-power';
import * as simpsonsParadox from './explorables/simpsons-paradox';
import * as biasVariance from './explorables/bias-variance';
import * as bayesBaseRates from './explorables/bayes-base-rates';
import * as centralLimit from './explorables/central-limit';
import * as gradientDescent from './explorables/gradient-descent';

export interface ExplorableModule<S extends ParamSchema = ParamSchema> {
  meta: ExplorableMeta;
  schema: S;
  View: ComponentType<{ params: ParamApi<S>; controls?: ReactNode }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const registry: readonly ExplorableModule<any>[] = [
  taxIncidence,
  waveInterference,
  survivalAnalysis,
  bayesBaseRates,
  centralLimit,
  statisticalPower,
  simpsonsParadox,
  biasVariance,
  gradientDescent,
];

export function findExplorable(slug: string): ExplorableModule<any> | undefined {
  return registry.find((e) => e.meta.slug === slug);
}
