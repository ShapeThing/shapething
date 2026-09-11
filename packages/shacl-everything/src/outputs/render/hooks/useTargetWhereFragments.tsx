import { useEffect, useMemo, useRef } from "react";
import type { Quad_Subject } from "@rdfjs/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { RdfStore } from "rdf-stores";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { termKey } from "@/helpers/termKey.ts";
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
    // Every watched write bumps `revision`, which is part of the query key - without this, each
    // bump starts a brand-new cache entry with `data: undefined` until the next revision's (async)
    // check resolves, flashing every already-attached fragment's fields away and back on every
    // qualifying edit. Same fix useWidget.tsx already applies for its own revision-keyed query.
    placeholderData: keepPreviousData,
    ...noRefetch,
  });

  // Stabilizes the returned array's reference across revisions whose resolved fragment set is
  // identical (order-independent) to the last one returned - `data` is a freshly built array on
  // every resolved revision even when nothing actually changed, and callers (NodeUIComponent) feed
  // it straight into a useMemo dependency array that rebuilds the whole node's element tree on any
  // reference change. Computed inline during render (not in the effect below, which runs after the
  // commit that would otherwise already have used a fresh reference) - idempotent for a given
  // `data`, so safe under StrictMode's double-invocation.
  const stableFragmentsRef = useRef<{ signature: string; value: Quad_Subject[] }>({
    signature: "",
    value: [],
  });
  const fragments = useMemo(() => {
    const resolved = data ?? [];
    const signature = resolved.map(termKey).sort().join("|");
    if (signature !== stableFragmentsRef.current.signature) {
      stableFragmentsRef.current = { signature, value: resolved };
    }
    return stableFragmentsRef.current.value;
  }, [data]);

  // Logs whenever a sh:targetWhere fragment starts or stops matching focusNode, so a form change
  // driven purely by data no longer conforming to a where-target (rather than an explicit widget
  // interaction) is still visible - the previous set is only compared once `data` has resolved at
  // least once, so the initial attachment on mount is silent.
  const previousFragmentsRef = useRef<Quad_Subject[] | undefined>(undefined);
  useEffect(() => {
    if (data === undefined) return;
    const previous = previousFragmentsRef.current;
    if (previous !== undefined) {
      const previousKeys = new Set(previous.map(termKey));
      const currentKeys = new Set(fragments.map(termKey));
      const attached = fragments.filter((shape) => !previousKeys.has(termKey(shape)));
      const detached = previous.filter((shape) => !currentKeys.has(termKey(shape)));
      if (attached.length > 0 || detached.length > 0) {
        console.log(
          `[shacl-everything] sh:targetWhere fragments changed for focus node <${focusNode.value}>`,
          { attached: attached.map((shape) => shape.value), detached: detached.map((shape) => shape.value) },
        );
      }
    }
    previousFragmentsRef.current = fragments;
  }, [data, fragments, focusNode]);

  return fragments;
}
