import { use, useSyncExternalStore } from "react";
import type { RdfStore } from "rdf-stores";

// Query results live as long as their store. An edit makes a new store, so nothing goes stale -
// but until a query has run again on the new store, its result on the previous store is shown,
// so an edit doesn't wait for every query on the page.

type Entry = {
  status: "pending" | "fulfilled" | "rejected";
  value?: unknown;
  // The result on the store this one replaced, shown while this one is pending.
  previous?: { value: unknown };
  subscribe: (listener: () => void) => () => void;
};

const caches = new WeakMap<RdfStore, Map<string, Promise<unknown>>>();
const entries = new WeakMap<Promise<unknown>, Entry>();
const predecessors = new WeakMap<RdfStore, RdfStore>();

// Records that `next` replaces `store` after an edit.
export function replaceStore(store: RdfStore, next: RdfStore): void {
  predecessors.set(next, store);
}

function previousResult(store: RdfStore, key: string): { value: unknown } | undefined {
  for (let older = predecessors.get(store); older; older = predecessors.get(older)) {
    const promise = caches.get(older)?.get(key);
    const entry = promise && entries.get(promise);
    if (entry?.status === "fulfilled") return { value: entry.value };
  }
  return undefined;
}

let refreshing = 0;
const refreshListeners = new Set<() => void>();
// Queries start during a render, which may not update other components.
const setRefreshing = (change: number) =>
  queueMicrotask(() => {
    refreshing += change;
    for (const listener of refreshListeners) listener();
  });

// The same promise for the same store and key.
export function cached<T>(store: RdfStore, key: string, load: () => Promise<T>): Promise<T> {
  let cache = caches.get(store);
  if (!cache) caches.set(store, (cache = new Map()));
  if (!cache.has(key)) {
    const promise = load();
    const listeners = new Set<() => void>();
    const entry: Entry = {
      status: "pending",
      previous: previousResult(store, key),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    if (entry.previous) setRefreshing(1);
    const settle = (status: Entry["status"], value?: unknown) => {
      Object.assign(entry, { status, value });
      // How React's use() reads a settled promise without suspending again.
      Object.assign(
        promise,
        status === "fulfilled" ? { status, value } : { status, reason: value },
      );
      if (entry.previous) setRefreshing(-1);
      for (const listener of listeners) listener();
    };
    promise.then(
      (value) => settle("fulfilled", value),
      (error: unknown) => settle("rejected", error),
    );
    entries.set(promise, entry);
    cache.set(key, promise);
  }
  return cache.get(key) as Promise<T>;
}

const noSubscription = () => () => {};

// A cached result: suspends on a first load, shows the previous store's result while refreshing.
export function useCached<T>(promise: Promise<T>): T {
  const entry = entries.get(promise);
  const status = useSyncExternalStore(
    entry?.subscribe ?? noSubscription,
    () => entry?.status ?? "untracked",
  );
  if (status === "pending" && entry?.previous) return entry.previous.value as T;
  return use(promise);
}

// Whether results on the page are being refreshed after an edit.
export function useRefreshing(): boolean {
  return useSyncExternalStore(
    (listener) => {
      refreshListeners.add(listener);
      return () => refreshListeners.delete(listener);
    },
    () => refreshing > 0,
  );
}
