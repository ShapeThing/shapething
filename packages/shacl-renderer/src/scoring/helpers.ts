import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf, shui } from "@/helpers/namespaces.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { validate, type ValidateProps } from "@/validation/validate.ts";
import { termKey } from "@/helpers/termKey.ts";

/**
 * The one ranking order both select() and score() use: descending shui:score, ties broken by the
 * widget's own IRI (ascending) - never by quad/glob order, which depends on which widget folders
 * happen to exist and how the scoring graph was concatenated, so two equally-scored widgets would
 * otherwise swap winners for reasons unrelated to the shapes being rendered.
 */
export function compareScored(
  a: { score: number; widget: Term },
  b: { score: number; widget: Term },
): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.widget.value === b.widget.value) return 0;
  return a.widget.value < b.widget.value ? -1 : 1;
}

/**
 * All shui:WidgetScore rules for the given mode (widgetPredicate), ordered by compareScored.
 * Throws on a rule without a numeric shui:score.
 */
export function orderedWidgetScores(
  scoringGraph: RdfStore,
  widgetPredicate: Term,
): Array<{ widgetScore: Term; widget: Term; score: number }> {
  return scoringGraph.getQuads(null, widgetPredicate)
    .filter((quad) => hasType(scoringGraph, quad.subject, shui("WidgetScore")))
    .map((quad) => {
      const widgetScore = quad.subject;
      const [scoreQuad] = scoringGraph.getQuads(widgetScore, shui("score"));
      const score = scoreQuad ? parseFloat(scoreQuad.object.value) : NaN;

      if (isNaN(score)) {
        throw new Error(
          `Invalid Widget Score definition for ${widgetScore.value}`,
        );
      }

      return { widgetScore, widget: quad.object, score };
    })
    .sort(compareScored);
}

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

/** validate() (validation/validate.ts), memoized per (targetGraph, focusNode, shapeNode) - see helpers.ts's shapeValidationCache. */
export async function cachedValidate(props: ValidateProps): Promise<boolean> {
  const { focusNode, targetGraph, shapeNode } = props;
  if (!focusNode) return validate(props);

  return shapeValidationCache.getOrCompute(
    targetGraph,
    `${termKey(focusNode)}-${termKey(shapeNode)}`,
    () => validate(props),
  );
}

export const hasType = (graph: RdfStore, subject: Term, type: Term): boolean =>
  graph.getQuads(subject, rdf("type"), type).length > 0;

export const objects = (graph: RdfStore, subject: Term, predicate: Term): Term[] =>
  graph.getQuads(subject, predicate).map((quad) => quad.object);

/** Whether focusNode conforms to every one of shapeNodes, stopping at the first failure. */
export async function allValid(
  props: Omit<ValidateProps, "shapeNode">,
  shapeNodes: Term[],
): Promise<boolean> {
  for (const shapeNode of shapeNodes) {
    if (!(await cachedValidate({ ...props, shapeNode }))) return false;
  }
  return true;
}
