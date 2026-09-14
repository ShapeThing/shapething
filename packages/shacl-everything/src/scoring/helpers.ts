import type { Quad } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { Engine as ShaclEngine } from "shacl-engine";
import { factory } from "@/helpers/factory.ts";
import { shui } from "@/helpers/namespaces.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { validate, type ValidateProps } from "@/scoring/score.ts";
import { termKey } from "@/helpers/termKey.ts";

export const orderByScore = (
  widgetScores: Array<Quad>,
  scoringGraph: RdfStore,
) =>
  widgetScores
    .sort((a, b) => {
      const aScore = parseFloat(
        scoringGraph.getQuads(a.subject, shui("score"))[0]?.object.value ??
          "0",
      );
      const bScore = parseFloat(
        scoringGraph.getQuads(b.subject, shui("score"))[0]?.object.value ??
          "0",
      );
      return bScore - aScore;
    });

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

/**
 * Backs score.ts's cachedValidate() - keyed per whichever RdfStore is being validated against
 * (dataGraph or shapesGraph), so entries for the two never collide even though they share one
 * cache. A dataGraph's entries clear themselves on every write (see createReactiveCache above);
 * shapesGraph is read-only for an Environment's whole lifetime (never wrapped in makeReactive), so
 * getReactivity(shapesGraph) is always undefined and its entries simply memoize forever.
 */
export const shapeValidationCache = createReactiveCache<Promise<boolean>>();

// Compiling a ShaclEngine parses every shape in shapesGraph up front (see shacl-engine's
// Engine constructor), which is wasted work when repeated for the same shapesGraph - as
// happens here, since matcher() always validates against the same scoringGraph, once or twice
// per candidate widget. Keyed by object identity (scoringGraph is a stable, cached instance per
// registry.ts), so this never serves a stale engine for a graph that's actually changed.
const shaclEngineCache = new WeakMap<RdfStore, ShaclEngine>();

export function getShaclEngine(shapesGraph: RdfStore): ShaclEngine {
  let shaclEngine = shaclEngineCache.get(shapesGraph);
  if (!shaclEngine) {
    shaclEngine = new ShaclEngine(shapesGraph.asDataset(), { factory });
    shaclEngineCache.set(shapesGraph, shaclEngine);
  }
  return shaclEngine;
}

/** validate(), memoized per (targetGraph, focusNode, shapeNode) - see helpers.ts's shapeValidationCache. */
export async function cachedValidate(props: ValidateProps): Promise<boolean> {
  const { focusNode, targetGraph, shapeNode } = props;
  if (!focusNode) return validate(props);

  return shapeValidationCache.getOrCompute(
    targetGraph,
    `${termKey(focusNode)}-${termKey(shapeNode)}`,
    () => validate(props),
  );
}
