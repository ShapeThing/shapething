import type { RdfStore } from "rdf-stores";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";

// A shapes graph is very often rendered over and over with a different resource each time - one
// renderer switching focusNode, a list of renderers, view-in-place modals. Each preprocessing pass
// builds its own copy of it, yet everything worth caching about a shapes graph is cached per store
// identity: compiled SHACL shapes (validation/validate.ts), the shape side of widget scoring
// (scoring/helpers.ts), memoByShapes (structure/shapeMemo.ts), the element trees
// (structure/childrenForShape.ts). Handing every pass whose shapes come out identical the very same
// store lets all of that carry over to the next resource, across renderer instances too.
//
// Identical means the same quads, blank nodes included: the same Turtle text always parses to the
// same quads (see resolveRdfSources.ts's parsedTexts), so a URL, string or store source qualifies;
// shapes generated from the data (addMissingShapes) or edited live do not, and simply get their own.
// Weakly held, so a shapes graph no longer rendered anywhere is still reclaimed.

const bySize = new Map<number, WeakRef<RdfStore>[]>();
// Distinct shapes graphs of one size kept for comparison - a handful is plenty for a page.
const KEPT_PER_SIZE = 4;

function sameQuads(a: RdfStore, b: RdfStore): boolean {
  if (a.size !== b.size) return false;
  for (const quad of a.getQuads()) {
    if (b.countQuads(quad.subject, quad.predicate, quad.object, quad.graph) === 0) return false;
  }
  return true;
}

/**
 * The store an earlier preprocessing pass produced with exactly `store`'s quads, if one is still
 * alive - else `store` itself, remembered for the next pass. Must only be given a store that is
 * read-only from here on, as a shapes graph is for an Environment's whole lifetime.
 */
export function internGraph(store: RdfStore): RdfStore {
  // A live (reactive) store is being edited - never a candidate to share.
  if (getReactivity(store)) return store;

  const live = (bySize.get(store.size) ?? []).filter((ref) => ref.deref() !== undefined);
  for (const ref of live) {
    const candidate = ref.deref()!;
    if (candidate === store || sameQuads(candidate, store)) return candidate;
  }
  live.push(new WeakRef(store));
  bySize.set(store.size, live.slice(-KEPT_PER_SIZE));
  return store;
}
