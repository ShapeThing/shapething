import type { Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { makeReactive, transact } from "@/helpers/reactiveRdfStore.ts";
import { termKey } from "@/helpers/termKey.ts";

/**
 * A scratch copy of `target` that a modal edits instead of `target` itself, so nothing becomes
 * real until the user confirms - shared by useCreateInPlace ("Create new…") and ResourceEditButton
 * (edit a referenced resource in place).
 */
export type StagingGraph = {
  // The reactive copy to edit - pass to <Modal dataGraph> so undo/redo inside the modal targets it.
  dataGraph: RdfStore;
  // What committing would write: only quads the draft actually touched, compared against `target`.
  changes: () => { additions: Quad[]; deletions: Quad[] };
  // Writes changes() into `target` as one undo step. `then` runs inside that same transaction,
  // after the content writes - e.g. linking a newly created resource (content before link, see
  // useSyncExternalStore's synchronous re-render on the first matching write).
  commit: (then?: () => void) => void;
};

const quadKey = (quad: Quad) =>
  [quad.subject, quad.predicate, quad.object, quad.graph].map(termKey).join(" ");

const has = (store: RdfStore, quad: Quad) =>
  store.getQuads(quad.subject, quad.predicate, quad.object, quad.graph).length > 0;

// A pass-through view of `store` that notes every quad it's asked to add or remove - including the
// undo/redo replays makeReactive() applies to its own target, since this view *is* that target.
// Lets changes() diff only what the draft touched, instead of snapshotting the whole graph up front
// and diffing all of it again at the end.
function recordingStore(store: RdfStore, touched: Map<string, Quad>): RdfStore {
  return new Proxy(store, {
    get(target, property) {
      if (property === "addQuad" || property === "removeQuad") {
        return (quad: Quad) => {
          touched.set(quadKey(quad), quad);
          return property === "addQuad" ? target.addQuad(quad) : target.removeQuad(quad);
        };
      }
      // Bound to the real store - see makeReactive()'s own note on RdfStore's private fields.
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * Still a full copy of `target` - the draft's own nested widgets read the rest of the graph too
 * (labels, other instances for a nested reference picker). It's populated, and `seed` applied,
 * *before* being made reactive, so neither the copy nor the seed is undo-able inside the modal -
 * but seed writes are recorded, so they're still part of changes().
 */
export function createStagingGraph(
  target: RdfStore,
  seed?: (store: RdfStore) => void,
): StagingGraph {
  const plainStore = RdfStore.createDefault();
  for (const quad of target.getQuads()) plainStore.addQuad(quad);

  const touched = new Map<string, Quad>();
  const recording = recordingStore(plainStore, touched);
  seed?.(recording);
  const dataGraph = makeReactive(recording);

  const changes = () => {
    const quads = [...touched.values()];
    return {
      additions: quads.filter((quad) => has(dataGraph, quad) && !has(target, quad)),
      deletions: quads.filter((quad) => !has(dataGraph, quad) && has(target, quad)),
    };
  };

  const commit = (then?: () => void) => {
    const { additions, deletions } = changes();
    transact(target, () => {
      for (const quad of deletions) target.removeQuad(quad);
      for (const quad of additions) target.addQuad(quad);
      then?.();
    });
  };

  return { dataGraph, changes, commit };
}
