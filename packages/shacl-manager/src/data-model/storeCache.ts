import type { RdfStore } from "rdf-stores";

// Query results live as long as their store. An edit makes a new store, so nothing goes stale.
const caches = new WeakMap<RdfStore, Map<string, Promise<unknown>>>();

// The same promise for the same store and key, so `use()` can suspend on it across renders.
export function cached<T>(store: RdfStore, key: string, load: () => Promise<T>): Promise<T> {
  let cache = caches.get(store);
  if (!cache) caches.set(store, (cache = new Map()));
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as Promise<T>;
}
