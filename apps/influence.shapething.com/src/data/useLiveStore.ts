import type { Quad } from "@rdfjs/types";
import { makeReactive, untracked } from "@shapething/shacl-renderer";
import { RdfStore } from "rdf-stores";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * One live store for the answers of some queries, which the renderers show from: each answer is
 * added once, when it arrives (data, not an edit: untracked, so never an undo step), and stays. The
 * component renders again once it is in, so what it reads from the store itself is current.
 * Answers are told apart by identity: keep an answer the same array between renders.
 */
export const useLiveStore = (answers: ReadonlyArray<readonly Quad[] | undefined>): RdfStore => {
  const store = useMemo(() => makeReactive(RdfStore.createDefault()), []);
  const added = useRef(new WeakSet<readonly Quad[]>());
  const [, setRevision] = useState(0);

  useEffect(() => {
    const fresh = answers.filter(
      (quads): quads is readonly Quad[] => quads !== undefined && !added.current.has(quads),
    );
    if (!fresh.length) return;
    // Marked first: what is added becomes visible to the next render, whenever it is written.
    fresh.forEach((quads) => added.current.add(quads));
    untracked(store, () => {
      for (const quads of fresh) quads.forEach((quad) => store.addQuad(quad));
    });
    setRevision((revision) => revision + 1);
  });

  return store;
};
