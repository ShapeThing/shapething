import { RdfStore } from "rdf-stores";

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

/**
 * A store a preprocessing step may add to or remove from: `store` itself when this pass owns it,
 * else a copy, which the pass then owns - so a chain of writing steps copies a caller's store at
 * most once instead of once per step.
 */
export function writableStore(store: RdfStore): RdfStore {
  if (isOwned(store)) return store;
  const copy = RdfStore.createDefault();
  for (const quad of store.getQuads()) copy.addQuad(quad);
  return markOwned(copy);
}

/**
 * Set by runPreprocessors on the environment of a re-preprocess, to the live dataGraph it carries
 * over (its keepDataGraph): resolveRdfSources then takes that store as it is, instead of the copy it
 * otherwise makes of a store it is handed. The store replaces whatever preprocessing resolves for
 * dataGraph anyway, so a copy would only be read and thrown away - and preprocessing never writes
 * to it, nor were its owl:imports missing from it (the first pass merged them into the store it
 * became). Kept on the environment rather than marked on the store, so it holds for this one pass
 * only: the same live store handed to another renderer as its dataGraph is still copied there.
 */
export const KEPT_DATA_GRAPH: unique symbol = Symbol("keptDataGraph");
