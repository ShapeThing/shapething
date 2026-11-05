import { RdfStore } from "rdf-stores";

/**
 * A read-only-by-convention copy of `store`'s current quads, built on `store`'s own term
 * dictionary (rdf-stores' counterpart of N3's shared entity index): every term is already encoded
 * there, so the copy holds nothing but numeric id tuples, never a second copy of any term. Keeps a
 * single SPOG index rather than the default three, since a snapshot is only ever read back whole or
 * probed for exact quads (both fully bound, so SPOG serves them as well as any other order).
 *
 * The dictionary is append-only, so later writes to `store` never invalidate the snapshot's ids.
 */
export function snapshotStore<TE>(store: RdfStore<TE>): RdfStore<TE> {
  const snapshot = new RdfStore<TE>({
    ...store.options,
    indexCombinations: [["subject", "predicate", "object", "graph"]],
    dictionary: store.dictionary,
  });
  for (const quad of store.readQuads()) snapshot.addQuad(quad);
  return snapshot;
}
