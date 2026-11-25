import { useCallback, useRef, useSyncExternalStore } from "react";
import type { RdfStore } from "rdf-stores";
import { getReactivity, type Pattern } from "@/helpers/reactiveRdfStore.ts";

type Cache<T> = { key: string; value: T };

/**
 * Runs `read` against `store`, kept live: a write elsewhere in the app only re-renders the
 * caller when it actually touches a getQuads() pattern `read` itself consulted - see
 * helpers/reactiveRdfStore.ts. `key` identifies when `read` itself needs to be re-run (e.g. it
 * closes over different arguments) - changing it invalidates the cache even without a write.
 * Falls back to a single untracked call, with no live updates, when `store` wasn't wrapped
 * via makeReactive() (e.g. a store built directly in a test).
 *
 * The subscription is stable for the store's lifetime rather than re-created every render: a
 * fresh `subscribe` closure makes useSyncExternalStore tear the old subscription down and set a
 * new one up in its passive effect, and React runs a child's effects before its parent's - so a
 * write made from a child's effect (e.g. DetailsEditor linking a just-filled placeholder) would
 * land in that gap, notify nobody, and leave this cache stale indefinitely. The recorded patterns
 * change as `read` re-runs, so they live in one array the subscriber holds by reference and that
 * compute() updates in place.
 */
export function useReactiveRead<T>(store: RdfStore, key: string, read: () => T): T {
  const cache = useRef<Cache<T> | null>(null);
  const patterns = useRef<Pattern[]>([]);
  const reactivity = getReactivity(store);

  const compute = (): Cache<T> => {
    if (!reactivity) return { key, value: read() };
    const tracked = reactivity.track(read);
    // Updated in place (not via splice's spread, which passes every pattern as an argument and
    // can overflow the call stack for a read that tracks tens of thousands of them).
    const current = patterns.current;
    current.length = 0;
    for (const pattern of tracked.patterns) current.push(pattern);
    reactivity.patternsChanged(current);
    return { key, value: tracked.result };
  };

  // The value `read` last returned for `key`, kept across a write's invalidation: when a write
  // re-runs `read` and it comes out the same (new array, same terms), the previous reference is
  // handed back, so useSyncExternalStore sees no change and the caller doesn't re-render.
  const previous = useRef<Cache<T> | null>(null);

  const getSnapshot = () => {
    if (!cache.current || cache.current.key !== key) {
      const next = compute();
      cache.current =
        previous.current?.key === next.key && sameValue(previous.current.value, next.value, 3)
          ? previous.current
          : next;
      previous.current = cache.current;
    }
    return cache.current.value;
  };

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!reactivity) return () => {};
      return reactivity.subscribe(patterns.current, () => {
        cache.current = null;
        onStoreChange();
      });
    },
    [reactivity],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

type TermLike = { termType: string; equals: (other: unknown) => boolean };
const isTerm = (value: unknown): value is TermLike =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as TermLike).termType === "string" &&
  typeof (value as TermLike).equals === "function";
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/**
 * Whether `a` and `b` are the same as far as a renderer can tell: identical, equal RDF terms, or
 * arrays/plain objects of such, compared to `depth` levels. Only ever answers true when certain -
 * anything it can't see into (a class instance, a deeper level) only counts as equal when it is
 * the very same object.
 */
function sameValue(a: unknown, b: unknown, depth: number): boolean {
  if (Object.is(a, b)) return true;
  if (isTerm(a) && isTerm(b)) return a.equals(b);
  if (depth === 0) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index], depth - 1));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key], depth - 1))
    );
  }
  return false;
}
