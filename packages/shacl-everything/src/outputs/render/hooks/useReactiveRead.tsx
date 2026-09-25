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
    patterns.current.splice(0, patterns.current.length, ...tracked.patterns);
    return { key, value: tracked.result };
  };

  const getSnapshot = () => {
    if (!cache.current || cache.current.key !== key) cache.current = compute();
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
