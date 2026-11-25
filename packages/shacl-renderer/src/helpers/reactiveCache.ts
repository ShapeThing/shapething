import type { RdfStore } from "rdf-stores";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";

/**
 * A string-keyed cache of values derived from one RdfStore, for memoizing an expensive computation
 * (e.g. SHACL validation) that would otherwise re-run for the same store+key combination. Scoped to
 * the store's own lifetime (a WeakMap, so a store's cache is reclaimed along with it - never a
 * global/cross-environment cache) and cleared in full on every write the store's own reactivity
 * system reports (see reactiveRdfStore.ts) - a `store` that isn't reactive (e.g. a plain store in a
 * unit test) still gets per-key memoization, just with no invalidation, since there is then no
 * write to invalidate on.
 */
export type ReactiveCache<T> = {
  /** The cached value for `key` in `store`'s cache, computing and storing it via `compute` first if absent. */
  getOrCompute: (store: RdfStore, key: string, compute: () => T) => T;
};

export function createReactiveCache<T>(): ReactiveCache<T> {
  const cachesByStore = new WeakMap<RdfStore, Map<string, T>>();

  function cacheFor(store: RdfStore): Map<string, T> {
    let cache = cachesByStore.get(store);
    if (!cache) {
      cache = new Map();
      cachesByStore.set(store, cache);
      getReactivity(store)?.subscribe(
        [{ subject: null, predicate: null, object: null, graph: null }],
        () => cache!.clear(),
      );
    }
    return cache;
  }

  return {
    getOrCompute: (store, key, compute) => {
      const cache = cacheFor(store);
      let value = cache.get(key);
      if (value === undefined) {
        value = compute();
        cache.set(key, value);
      }
      return value;
    },
  };
}
