import type { RdfStore } from "rdf-stores";

// Stores a preprocessing pass created itself (e.g. resolveRdfSources' own copy of shapesGraph),
// as opposed to a store a caller handed in - which preprocessing must never mutate in place, since
// the caller may still read or reuse it. A later step may add to an owned store directly rather
// than paying for a full copy first (a copy of a large shapes graph costs ~1 ms per 1,000 quads,
// once per pass). Custom preprocessors can reorder or replace steps, so this is tracked per store
// instead of assumed from the step order.
const owned = new WeakSet<RdfStore>();

export function markOwned<T extends RdfStore | undefined>(store: T): T {
  if (store) owned.add(store);
  return store;
}

export function isOwned(store: RdfStore): boolean {
  return owned.has(store);
}
