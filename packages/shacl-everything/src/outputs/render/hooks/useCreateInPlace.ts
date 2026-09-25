import { useMemo, useState } from "react";
import type { NamedNode, Quad, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { makeReactive, transact } from "@/helpers/reactiveRdfStore.ts";
import { termKey } from "@/helpers/termKey.ts";
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

const quadKey = (quad: Quad) =>
  [quad.subject, quad.predicate, quad.object, quad.graph].map(termKey).join(" ");

// A pass-through view of `store` that notes every quad it's asked to add or remove - including the
// undo/redo replays makeReactive() applies to its own target, since this view *is* that target.
// Lets commit() diff only what the draft actually touched, instead of snapshotting the whole graph
// up front and diffing all of it again at the end.
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

const has = (store: RdfStore, quad: Quad) =>
  store.getQuads(quad.subject, quad.predicate, quad.object, quad.graph).length > 0;

/**
 * The shared "Create new…" flow of the reference-picking editors (InstancesSelectEditor,
 * AutoCompleteEditor): the new instance is built up against its own scratch copy of the graph, not
 * `shape.dataGraph` directly, so nothing real is written - not even the new subject's own
 * rdf:type - unless the user confirms. A random IRI identifies it for now (a real identifier is
 * deferred to a future widget on the node shape itself that can edit both blank nodes and IRIs),
 * so the widgets' own isIRI-scored selection stays valid for the new value straight away.
 *
 * The scratch copy is still a full copy - the draft's own nested widgets read the rest of the
 * graph too (labels, other instances for a nested reference picker) - but it is populated *before*
 * being made reactive, so neither the copy nor the initial rdf:type is undo-able inside the modal.
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
    { draft: CreateInPlaceDraft; touched: Map<string, Quad> } | undefined
  >(undefined);

  const start = () => {
    if (!canCreate) return;
    const subject = factory.namedNode(`urn:uuid:${crypto.randomUUID()}`);
    const plainStore = RdfStore.createDefault();
    for (const quad of shape.dataGraph.getQuads()) plainStore.addQuad(quad);

    const touched = new Map<string, Quad>();
    const recording = recordingStore(plainStore, touched);
    for (const shClass of shape.get(sh("class"))) {
      recording.addQuad(factory.quad(subject, rdf("type"), shClass as NamedNode));
    }
    const dataGraph = makeReactive(recording);
    const node = nestedNodeElement(shape, subject, { nodeShapes, dataGraph });
    setState({ draft: { subject, dataGraph, node }, touched });
  };

  const commit = () => {
    if (!state) return false;
    const { draft, touched } = state;
    const target = shape.dataGraph;
    const deletions = [...touched.values()].filter((quad) => !has(draft.dataGraph, quad) && has(target, quad));
    const additions = [...touched.values()].filter((quad) => has(draft.dataGraph, quad) && !has(target, quad));
    // Content first, link (setTerm) last: useSyncExternalStore re-renders synchronously on the first
    // matching write, so the new instance's own triples must already be there once it's linked in.
    transact(target, () => {
      for (const quad of deletions) target.removeQuad(quad);
      for (const quad of additions) target.addQuad(quad);
      setTerm(draft.subject);
    });
    setState(undefined);
    return true;
  };

  const cancel = () => setState(undefined);

  return { canCreate, nodeShapes, draft: state?.draft, start, commit, cancel };
}
