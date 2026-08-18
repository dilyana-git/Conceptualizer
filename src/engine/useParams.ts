/**
 * schema → state hook, with URL round-tripping. SPEC §4, §6.
 *
 * §3.1: Zustand holds per-explorable parameter state. There is no global store —
 * each call to `useParams` owns its own vanilla store instance, so two
 * explorables on one page could never collide.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createStore } from 'zustand/vanilla';
import {
  decodeParams,
  defaultsOf,
  encodeParams,
  isDirtyAgainst,
  validateSchema,
  type ParamSchema,
  type ParamValues,
} from './params';

/** §6: writing to the URL is debounced so dragging does not thrash history. */
export const URL_DEBOUNCE_MS = 400;

export interface ParamApi<S extends ParamSchema> {
  values: ParamValues<S>;
  set: <K extends keyof ParamValues<S>>(id: K, value: ParamValues<S>[K]) => void;
  reset: () => void;
  isDirty: boolean;
  /** Absolute URL reproducing exactly the current state. */
  shareUrl: string;
}

interface ParamState<S extends ParamSchema> {
  values: ParamValues<S>;
}

function initialValues<S extends ParamSchema>(schema: S): ParamValues<S> {
  if (typeof window === 'undefined') return defaultsOf(schema);
  return decodeParams(schema, window.location.search);
}

export function useParams<S extends ParamSchema>(schema: S): ParamApi<S> {
  // Validate once per schema identity. Authoring bugs surface immediately.
  useMemo(() => validateSchema(schema), [schema]);

  const store = useMemo(
    () => createStore<ParamState<S>>(() => ({ values: initialValues(schema) })),
    [schema],
  );

  const values = useSyncExternalStore(
    store.subscribe,
    () => store.getState().values,
    () => store.getState().values,
  );

  const set = useCallback<ParamApi<S>['set']>(
    (id, value) => {
      store.setState((prev) => {
        if (prev.values[id] === value) return prev;
        return { values: { ...prev.values, [id]: value } };
      });
    },
    [store],
  );

  const reset = useCallback(() => {
    store.setState({ values: defaultsOf(schema) });
  }, [store, schema]);

  const query = useMemo(() => encodeParams(schema, values), [schema, values]);
  const isDirty = useMemo(() => isDirtyAgainst(schema, values), [schema, values]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return query ? `?${query}` : '';
    const { origin, pathname } = window.location;
    return query ? `${origin}${pathname}?${query}` : `${origin}${pathname}`;
  }, [query]);

  // §6: debounced replaceState. replaceState (not pushState) keeps the back
  // button meaning "the page before this one", not "the slider a moment ago".
  const firstWrite = useRef(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (firstWrite.current) {
      // Do not rewrite the URL just for mounting; only for real changes.
      firstWrite.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState(null, '', next);
    }, URL_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  return { values, set, reset, isDirty, shareUrl };
}
