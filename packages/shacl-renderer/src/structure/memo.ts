import { RdfStore } from "rdf-stores";

/**
 * A memo keyed by the *identity* of a fixed-length list of objects (typically the RdfStores and
 * widget registry an element is built from) plus a string key for everything else (shape/focus
 * node termKeys, ancestorPath). Each object level is a WeakMap, so an entry lives exactly as long
 * as every object it was keyed on - e.g. a one-off store built by rdf-to-js/generate is reclaimed
 * along with everything memoized against it, rather than pinned by a module-level cache.
 *
 * Only ever used here for values derived from shapesGraph alone (which is read-only for an
 * Environment's whole lifetime - see preprocess/index.ts), never for anything read from dataGraph:
 * dataGraph is only part of the key because every element carries it, not because the cached value
 * depends on its contents. That's what makes structure/'s elements safe to hand out as the same
 * instance on every call - their data reads (getObjects() etc.) stay live.
 */
export function createIdentityMemo<V>() {
  type Level = { next: WeakMap<object, Level>; values: Map<string, V> };
  const newLevel = (): Level => ({ next: new WeakMap(), values: new Map() });
  const root = newLevel();

  return function memo(objects: readonly object[], key: string, compute: () => V): V {
    let level = root;
    for (const object of objects) {
      let next = level.next.get(object);
      if (!next) {
        next = newLevel();
        level.next.set(object, next);
      }
      level = next;
    }
    if (level.values.has(key)) return level.values.get(key)!;
    const value = compute();
    level.values.set(key, value);
    return value;
  };
}

// The scoresGraph an element falls back to when constructed without one (structure-only callers:
// tools, validateDynamicInProperties, unit tests). One shared instance rather than a fresh
// RdfStore per element, so it can take part in createIdentityMemo keys (and scoring's own
// WeakMap caches) like any real scoresGraph. Never written to.
export const EMPTY_SCORES_GRAPH: RdfStore = RdfStore.createDefault();
