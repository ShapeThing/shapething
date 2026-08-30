import { useEffect, useRef, type FormEvent } from "react";
import { Localized } from "@fluent/react";
import { RdfStore } from "rdf-stores";
import { diffQuads } from "@/helpers/diffQuads.ts";
import { ex } from "@/helpers/namespaces.ts";
import { getReactivity } from "@/helpers/reactiveRdfStore.ts";
import { createFilterShape, type FilterShape } from "@/structure/filterShape.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import NodeUIComponent from "@/outputs/render/modes/facet/NodeUIComponent.tsx";

type Props = {
  children?: React.ReactNode;
};

const FACET_CHANGE_DEBOUNCE_MS = 200;

/**
 * Facet mode's top-level wrapper (the counterpart to edit mode's EditModeWrapper). Owns the
 * generated filter shape for this session (structure/filterShape.ts) - created once and never
 * rebuilt, same "stable for the whole session" reasoning as EditModeWrapper's own dataGraph
 * snapshot - and hands it to the very same Environment.onSubmit callback edit mode uses, as a
 * SubmitResult (a fresh, non-reactive copy of the store, plus additions/deletions diffed against
 * its state right after creation - same diffQuads/fresh-store convention as EditModeWrapper's own
 * handleSubmit, so a caller doesn't need separate handling for either mode's output). Per
 * Environment.facetChangeMode: "live" (the default) calls onSubmit continuously, debounced the
 * same way ValidationContextProvider debounces live validation; "submit" instead renders an
 * explicit apply action (mirroring edit mode's own <form>/submit button) and only calls onSubmit
 * then.
 */
export default function FacetModeWrapper({ children }: Props) {
  const { facetChangeMode = "live", onSubmit, focusNode } = useEnvironment();

  // The generated shape's own identity: Environment.focusNode, when an embedder actually set one
  // (facet mode has no single focus node to render, so a real caller normally wouldn't - the
  // default placeholder value is the tell) - otherwise createFilterShape mints a fresh urn:uuid:,
  // so the returned shape always has a stable IRI rather than an anonymous blank node.
  const filterShapeRef = useRef<FilterShape | null>(null);
  filterShapeRef.current ??= createFilterShape(
    focusNode.equals(ex("focusNode")) ? undefined : focusNode,
  );
  const filterShape = filterShapeRef.current;

  // Captured once, right after the filter shape is created (createFilterShape seeds it with its
  // own root NodeShape triple) - the baseline every later diffQuads call compares against, so that
  // initial triple never shows up as a spurious "addition".
  const originalQuadsRef = useRef<ReturnType<RdfStore["getQuads"]> | null>(null);
  originalQuadsRef.current ??= filterShape.store.getQuads();

  const fire = () => {
    const finalQuads = filterShape.store.getQuads();
    const { additions, deletions } = diffQuads(originalQuadsRef.current!, finalQuads);

    const store = RdfStore.createDefault();
    for (const quad of finalQuads) store.addQuad(quad);

    onSubmit?.({ dataGraph: store, additions, deletions });
  };

  // Read by the live-mode subscription below, which persists across renders (it only restarts if
  // facetChangeMode/filterShape identity actually change) - always calling through this ref, not
  // closing over `fire` directly, keeps every firing using this render's latest onSubmit prop
  // instead of whichever one happened to be current when the subscription was first set up.
  const fireRef = useRef(fire);
  fireRef.current = fire;

  useEffect(() => {
    if (facetChangeMode !== "live") return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    fireRef.current();

    const unsubscribe = getReactivity(filterShape.store)?.subscribe(
      [{ subject: null, predicate: null, object: null, graph: null }],
      () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fireRef.current(), FACET_CHANGE_DEBOUNCE_MS);
      },
    );

    return () => {
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [facetChangeMode, filterShape]);

  if (facetChangeMode === "submit") {
    const handleSubmit = (event: FormEvent) => {
      event.preventDefault();
      fire();
    };

    return (
      <form onSubmit={handleSubmit} className="st-facet-mode">
        <NodeUIComponent filterShape={filterShape} />
        {children}
        <div className="st-facet-mode--actions">
          <button className="st-button st-button--primary" type="submit">
            <Localized id="facet-mode-apply">Apply filters</Localized>
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="st-facet-mode">
      <NodeUIComponent filterShape={filterShape} />
      {children}
    </div>
  );
}
