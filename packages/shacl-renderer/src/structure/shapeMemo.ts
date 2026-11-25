import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { createReactiveCache } from "@/helpers/reactiveCache.ts";
import { termKey } from "@/helpers/termKey.ts";

const cache = createReactiveCache<unknown>();

/**
 * Memoizes a derivation that reads nothing but the shapes graph - a property's resolved
 * constraints, its value nodes' role paths, and the like - per (shapesGraph, property shapes,
 * `kind`). These are asked for on every render of every value, while their inputs only change when
 * the shapes do: so they're shared across every focus node rendering the same property, and the
 * cache clears itself when a live (reactive) shapesGraph is written to (see reactiveCache.ts).
 *
 * The result is frozen when it's an array, since every caller now shares the very same one.
 */
export function memoByShapes<T>(
  source: { shapesGraph: RdfStore; propertyShapes: Term[] },
  kind: string,
  compute: () => T,
): T {
  const key = `${kind}\u0000${source.propertyShapes.map(termKey).join(" ")}`;
  return cache.getOrCompute(source.shapesGraph, key, () => {
    const value = compute();
    return Array.isArray(value) ? Object.freeze(value) : value;
  }) as T;
}
