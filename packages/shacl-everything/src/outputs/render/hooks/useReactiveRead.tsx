import { useRef, useSyncExternalStore } from "react";
import type { RdfStore } from "rdf-stores";
import { getReactivity, type Pattern } from "@/helpers/reactiveRdfStore.ts";

type Cache<T> = { key: string; value: T; patterns: Pattern[] };

/**
 * Runs `read` against `store`, kept live: a write elsewhere in the app only re-renders the
 * caller when it actually touches a getQuads() pattern `read` itself consulted - see
 * helpers/reactiveRdfStore.ts. `key` identifies when `read` itself needs to be re-run (e.g. it
 * closes over different arguments) - changing it invalidates the cache even without a write.
 * Falls back to a single untracked call, with no live updates, when `store` wasn't wrapped
 * via makeReactive() (e.g. a store built directly in a test).
 */
export function useReactiveRead<T>(store: RdfStore, key: string, read: () => T): T {
  const cache = useRef<Cache<T> | null>(null);
  const reactivity = getReactivity(store);

  const compute = (): Cache<T> => {
    if (!reactivity) return { key, value: read(), patterns: [] };
    const { result, patterns } = reactivity.track(read);
    return { key, value: result, patterns };
  };

  const getSnapshot = () => {
    if (!cache.current || cache.current.key !== key) cache.current = compute();
    return cache.current.value;
  };

  const subscribe = (onStoreChange: () => void) => {
    if (!reactivity) return () => {};
    if (!cache.current || cache.current.key !== key) cache.current = compute();
    return reactivity.subscribe(cache.current.patterns, () => {
      cache.current = null;
      onStoreChange();
    });
  };

  return useSyncExternalStore(subscribe, getSnapshot);
}
