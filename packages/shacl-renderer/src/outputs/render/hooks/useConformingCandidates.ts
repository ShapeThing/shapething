import { useEffect, useState } from "react";
import type { Term } from "@rdfjs/types";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { filterConformingResults } from "@/widgets/implementations/shui/editors/AutoCompleteEditor/validateSearchResults.ts";

const EVERY_WRITE = [{ subject: null, predicate: null, object: null, graph: null }];

/**
 * `candidates` (e.g. every local sh:class instance a picker would offer) narrowed down to only
 * the ones `shape` would actually accept as a value - its sh:node in particular, which a plain
 * sh:class instance lookup knows nothing about. Same check as shui:searchQuery's results get (see
 * validateSearchResults.ts's filterConformingResults), so a picker never offers a value the live
 * validation report would then reject.
 *
 * Re-checked on every dataGraph write, since a candidate's conformance depends on its own triples
 * (e.g. a just-edited organization gaining the property its sh:node requires). Undefined until the
 * first check resolves; later checks keep showing the previous result until they resolve.
 */
export function useConformingCandidates<T extends Term>(
  shape: PropertyUIElement,
  candidates: T[],
): T[] | undefined {
  const [revision, setRevision] = useState(0);
  const [conforming, setConforming] = useState<T[]>();
  // Nothing to check (e.g. AutoCompleteEditor with facet search off): no subscription to every
  // dataGraph write, and no validation pass per write either.
  const hasCandidates = candidates.length > 0;

  useEffect(
    () =>
      hasCandidates
        ? getReactivity(shape.dataGraph)?.subscribe(EVERY_WRITE, () => setRevision((r) => r + 1))
        : undefined,
    [shape.dataGraph, hasCandidates],
  );

  useEffect(() => {
    // An unchanged outcome keeps the previous array, so a write that doesn't affect any
    // candidate's conformance doesn't re-render the picker.
    const publish = (next: T[]) =>
      setConforming((previous) =>
        previous?.length === next.length && previous.every((term, i) => term.equals(next[i]!))
          ? previous
          : next,
      );
    if (!hasCandidates) {
      publish([]);
      return;
    }
    let cancelled = false;
    filterConformingResults(
      shape,
      candidates.map((term) => ({ term })),
    ).then((kept) => {
      if (cancelled) return;
      const keptValues = new Set(kept.map((result) => result.term.value));
      publish(candidates.filter((candidate) => keptValues.has(candidate.value)));
    });
    return () => {
      cancelled = true;
    };
  }, [shape, candidates, revision, hasCandidates]);

  return conforming;
}
