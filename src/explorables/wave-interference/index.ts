/**
 * §9: explorable modules are route-level code-split. `meta` and `schema` are
 * tiny and stay eager, because the registry needs them to route and to build a
 * control panel; the View and the model it pulls in are the bulk, and arrive
 * only when this explorable is actually opened.
 */
import { lazy } from 'react';

export { meta } from './meta';
export { schema } from './params';

export const View = lazy(() => import('./View').then((m) => ({ default: m.View })));
