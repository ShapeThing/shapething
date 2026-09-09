import { useMemo, useRef } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { useQuery } from "@tanstack/react-query";
import type { RdfStore } from "rdf-stores";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
import {
  predicatesReferencedByTargetWhereShapes,
  shapesWhereTargetingFocusNode,
} from "@/resolution/targets.ts";

/**
 * Live sh:targetWhere (3.1.3.6) fragment attachment: which shapes in `shapesGraph` currently apply
 * to `focusNode` purely via their own sh:targetWhere declaration (no explicit sh:and/sh:node/
 * sh:or link into the shape actually being rendered) - re-evaluated whenever a write could
 * plausibly change the answer, the way useActiveChoiceBranch re-detects an sh:or/sh:xone branch on
 * every write touching the focus node.
 *
 * This narrows further than that: predicatesReferencedByTargetWhereShapes finds which predicates
 * the sh:targetWhere shapes actually inspect, so an edit to an unrelated property (e.g. this
 * fixture's "Description") never even re-runs shapesWhereTargetingFocusNode's shacl-engine calls -
 * only a write to a watched predicate (e.g. "Claim type") does. Falls back to broad tracking
 * (any write with focusNode as subject/object) when no predicate could be derived, so an
 * unusual sh:targetWhere shape (no sh:path at all - a bare sh:class check, say) still stays live,
 * just without the narrowing.
 *
 * Uses a plain incrementing counter, not a content-derived count, as its revision signal:
 * useActiveChoiceBranch's own count-of-matching-quads works there because a branch switch always
 * changes which properties exist, but a targetWhere discriminator is commonly a single
 * maxCount:1 property whose VALUE is replaced in place (same quad count before/after) - a bare
 * count would look unchanged to useSyncExternalStore's Object.is check and silently skip the
 * refetch.
 */
export function useTargetWhereFragments(
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  focusNode: Quad_Subject,
): Quad_Subject[] {
  const watchedPredicates = useMemo(
    () => predicatesReferencedByTargetWhereShapes(shapesGraph),
    [shapesGraph],
  );

  const counterRef = useRef(0);
  const revision = useReactiveRead(dataGraph, `target-where-fragments@${focusNode.value}`, () => {
    if (watchedPredicates.length === 0) {
      dataGraph.getQuads(focusNode);
      dataGraph.getQuads(null, null, focusNode);
    } else {
      for (const predicate of watchedPredicates) dataGraph.getQuads(focusNode, predicate);
    }
    return ++counterRef.current;
  });

  const { data } = useQuery({
    queryKey: ["target-where-fragments", focusNode.value, revision],
    queryFn: () => shapesWhereTargetingFocusNode(focusNode, shapesGraph, dataGraph),
    ...noRefetch,
  });

  return data ?? [];
}
