/**
 * §5: the registry is a flat array. Adding an explorable is one folder plus one
 * import line — no CMS, no dynamic route generation, no MDX pipeline.
 *
 * §13: no placeholder entries. An empty folder for a future concept is a promise
 * the codebase will not keep, so the other five explorables in §8 appear here
 * only when they are actually built.
 */
import type { ComponentType, ReactNode } from 'react';
import type { ExplorableMeta } from './engine/meta';
import type { ParamSchema } from './engine/params';
import type { ParamApi } from './engine/useParams';

import { meta as taxIncidenceMeta, schema as taxIncidenceSchema, View as TaxIncidenceView } from './explorables/tax-incidence';
import { meta as survivalMeta, schema as survivalSchema, View as SurvivalView } from './explorables/survival-analysis';
import { meta as powerMeta, schema as powerSchema, View as PowerView } from './explorables/statistical-power';
import { meta as simpsonMeta, schema as simpsonSchema, View as SimpsonView } from './explorables/simpsons-paradox';
import { meta as biasVarianceMeta, schema as biasVarianceSchema, View as BiasVarianceView } from './explorables/bias-variance';

export interface ExplorableModule<S extends ParamSchema = ParamSchema> {
  meta: ExplorableMeta;
  schema: S;
  View: ComponentType<{ params: ParamApi<S>; controls?: ReactNode }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const registry: readonly ExplorableModule<any>[] = [
  { meta: taxIncidenceMeta, schema: taxIncidenceSchema, View: TaxIncidenceView },
  { meta: survivalMeta, schema: survivalSchema, View: SurvivalView },
  { meta: powerMeta, schema: powerSchema, View: PowerView },
  { meta: simpsonMeta, schema: simpsonSchema, View: SimpsonView },
  { meta: biasVarianceMeta, schema: biasVarianceSchema, View: BiasVarianceView },
];

export function findExplorable(slug: string): ExplorableModule<any> | undefined {
  return registry.find((e) => e.meta.slug === slug);
}
