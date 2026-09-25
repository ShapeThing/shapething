import { useMemo, useState } from "react";
import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { createStagingGraph, type StagingGraph } from "@/helpers/stagingGraph.ts";
import { canCreateInPlace, valueNodeShapes } from "@/resolution/label.ts";
import type { NodeUIElement } from "@/structure/NodeUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { nestedNodeElement } from "@/outputs/render/hooks/useNestedNode.ts";

export type CreateInPlaceDraft = {
  subject: NamedNode;
  // The staging copy the draft is edited in - pass to <Modal dataGraph> so undo/redo inside the
  // modal targets it, not the real graph.
  dataGraph: RdfStore;
  // The new instance's own form, over `dataGraph` - render with (edit mode's) NodeUIElementChildren.
  node: NodeUIElement;
};

export type CreateInPlace = {
  // Environment.enableCreateInPlace && canCreateInPlace(shape) - whether to offer "Create new…".
  canCreate: boolean;
  // valueNodeShapes(shape): the shape(s) describing a new instance's own fields. Also exposed for
  // widgets that need the same "shapes of this property's values" for other features.
  nodeShapes: Quad_Subject[];
  draft: CreateInPlaceDraft | undefined;
  // Mints a fresh instance of the property's sh:class(es) in a new staging copy and opens the draft.
  start: () => void;
  // Writes the staged changes into `shape.dataGraph` and adopts the new instance via setTerm, as one
  // undo step. Returns false when there was no draft to commit.
  commit: () => boolean;
  // Discards the draft - `shape.dataGraph` was never written to, so there's nothing to undo.
  cancel: () => void;
};

/**
 * The shared "Create new…" flow of the reference-picking editors (InstancesSelectEditor,
 * AutoCompleteEditor): the new instance is built up against its own scratch copy of the graph, not
 * `shape.dataGraph` directly, so nothing real is written - not even the new subject's own
 * rdf:type - unless the user confirms. A random IRI identifies it for now (a real identifier is
 * deferred to a future widget on the node shape itself that can edit both blank nodes and IRIs),
 * so the widgets' own isIRI-scored selection stays valid for the new value straight away.
 *
 * The scratch copy is a StagingGraph (helpers/stagingGraph.ts), seeded with the new subject's
 * rdf:type - see there for what is and isn't undo-able inside the modal.
 */
export function useCreateInPlace(
  shape: PropertyUIElement,
  setTerm: (term: Term) => void,
): CreateInPlace {
  const { enableCreateInPlace } = useEnvironment();
  const nodeShapes = useMemo(() => valueNodeShapes(shape), [shape]);
  const canCreate = useMemo(
    () => Boolean(enableCreateInPlace) && canCreateInPlace(shape),
    [enableCreateInPlace, shape],
  );
  const [state, setState] = useState<
    { draft: CreateInPlaceDraft; staging: StagingGraph } | undefined
  >(undefined);

  const start = () => {
    if (!canCreate) return;
    const subject = factory.namedNode(`urn:uuid:${crypto.randomUUID()}`);
    const staging = createStagingGraph(shape.dataGraph, (store) => {
      for (const shClass of shape.get(sh("class"))) {
        store.addQuad(factory.quad(subject, rdf("type"), shClass as NamedNode));
      }
    });
    const node = nestedNodeElement(shape, subject, { nodeShapes, dataGraph: staging.dataGraph });
    setState({ draft: { subject, dataGraph: staging.dataGraph, node }, staging });
  };

  const commit = () => {
    if (!state) return false;
    // Content first, link (setTerm) last: useSyncExternalStore re-renders synchronously on the first
    // matching write, so the new instance's own triples must already be there once it's linked in.
    state.staging.commit(() => setTerm(state.draft.subject));
    setState(undefined);
    return true;
  };

  const cancel = () => setState(undefined);

  return { canCreate, nodeShapes, draft: state?.draft, start, commit, cancel };
}
