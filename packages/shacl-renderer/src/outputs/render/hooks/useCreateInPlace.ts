import { useMemo, useState } from "react";
import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { freshIri } from "@/helpers/freshIri.ts";
import { rdf } from "@/helpers/namespaces.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { renameInStore } from "@/helpers/renameTerm.ts";
import { createStagingGraph, type StagingGraph } from "@/helpers/stagingGraph.ts";
import {
  createInPlaceOptions,
  propertyLabel,
  valueNodeShapes,
  type CreateInPlaceOption,
} from "@/resolution/label.ts";
import type { NodeUIElement } from "@/structure/NodeUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { seedDefaultValues } from "@/structure/defaultValues.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import { nestedNodeElement } from "@/outputs/render/hooks/useNestedNode.ts";

export type CreateInPlaceDraft = {
  subject: NamedNode;
  // The staging copy the draft is edited in - pass to <Modal dataGraph> so undo/redo inside the
  // modal targets it, not the real graph.
  dataGraph: RdfStore;
  // The new instance's own form, over `dataGraph` - render with (edit mode's) NodeUIElementChildren.
  node: NodeUIElement;
  // The IRI `subject` will be committed under - `subject` itself unless renamed through
  // renameSubject (Environment.enableFocusNodeEditor's field in the modal).
  renamedSubject: NamedNode;
};

// One "Create new…" row a widget renders. `label` (the class to create, e.g. "Dog") is only set when
// there's more than one row to tell apart - see createInPlaceOptions' dash:abstract handling.
export type CreateInPlaceChoice = {
  key: string;
  label: string | undefined;
  start: () => void;
};

export type CreateInPlace = {
  // Environment.enableCreateInPlace && canCreateInPlace(shape) - whether to offer "Create new…".
  canCreate: boolean;
  // One entry per kind of instance that can be created - a single one unless the property's
  // sh:class is dash:abstract and has several concrete subclasses to choose from.
  choices: CreateInPlaceChoice[];
  // valueNodeShapes(shape): the shape(s) describing a new instance's own fields. Also exposed for
  // widgets that need the same "shapes of this property's values" for other features.
  nodeShapes: Quad_Subject[];
  draft: CreateInPlaceDraft | undefined;
  // Mints a fresh instance of the property's sh:class(es) in a new staging copy and opens the draft -
  // the first of `choices`.
  start: () => void;
  // Writes the staged changes into `shape.dataGraph` and adopts the new instance via setTerm, as one
  // undo step. Returns false when there was no draft to commit.
  commit: () => boolean;
  // Discards the draft - `shape.dataGraph` was never written to, so there's nothing to undo.
  cancel: () => void;
  // Sets the IRI the draft will be committed under (see CreateInPlaceDraft.renamedSubject).
  renameSubject: (iri: NamedNode) => void;
};

/**
 * The shared "Create new…" flow of the reference-picking editors (InstancesSelectEditor,
 * AutoCompleteEditor): the new instance is built up against its own scratch copy of the graph, not
 * `shape.dataGraph` directly, so nothing real is written - not even the new subject's own
 * rdf:type - unless the user confirms. A random IRI identifies it unless the user picks a real one
 * (Environment.enableFocusNodeEditor, see renameSubject), so the widgets' own isIRI-scored
 * selection stays valid for the new value straight away.
 *
 * The scratch copy is a StagingGraph (helpers/stagingGraph.ts), seeded with the new subject's
 * rdf:type - see there for what is and isn't undo-able inside the modal.
 */
export function useCreateInPlace(
  shape: PropertyUIElement,
  setTerm: (term: Term) => void,
): CreateInPlace {
  const { enableCreateInPlace } = useEnvironment();
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const nodeShapes = useMemo(() => valueNodeShapes(shape), [shape]);
  const options = useMemo(
    () => (enableCreateInPlace ? createInPlaceOptions(shape) : []),
    [enableCreateInPlace, shape],
  );
  const canCreate = options.length > 0;
  const [state, setState] = useState<
    { draft: CreateInPlaceDraft; staging: StagingGraph } | undefined
  >(undefined);

  const startOption = (option: CreateInPlaceOption) => {
    const subject = freshIri(shape.shapesGraph);
    const staging = createStagingGraph(shape.dataGraph, (store) => {
      for (const classIri of option.classes) {
        store.addQuad(factory.quad(subject, rdf("type"), classIri as NamedNode));
      }
      // A brand-new instance, so it starts out with its shapes' sh:defaultValue values - part of the
      // seed, so not undo-able inside the modal but still committed (see createStagingGraph).
      seedDefaultValues(
        nestedNodeElement(shape, subject, { nodeShapes: option.nodeShapes, dataGraph: store }),
      );
    });
    const node = nestedNodeElement(shape, subject, {
      nodeShapes: option.nodeShapes,
      dataGraph: staging.dataGraph,
    });
    setState({
      draft: { subject, dataGraph: staging.dataGraph, node, renamedSubject: subject },
      staging,
    });
  };

  const start = () => {
    if (options[0]) startOption(options[0]);
  };

  const choices = options.map((option) => ({
    key: option.classes.map((classIri) => classIri.value).join(" "),
    label:
      options.length > 1
        ? propertyLabel({
            term: option.classes[0],
            propertyShape: shape,
            languages: [activeInterfaceLanguage],
          })
        : undefined,
    start: () => startOption(option),
  }));

  const commit = () => {
    if (!state) return false;
    const { draft, staging } = state;
    // Renamed inside the staging copy first, so what's committed only ever uses the final IRI.
    if (!draft.renamedSubject.equals(draft.subject)) {
      transact(draft.dataGraph, () =>
        renameInStore(draft.dataGraph, draft.subject, draft.renamedSubject),
      );
    }
    // Content first, link (setTerm) last: useSyncExternalStore re-renders synchronously on the first
    // matching write, so the new instance's own triples must already be there once it's linked in.
    staging.commit(() => setTerm(draft.renamedSubject));
    setState(undefined);
    return true;
  };

  const cancel = () => setState(undefined);

  const renameSubject = (iri: NamedNode) =>
    setState((current) =>
      current && { ...current, draft: { ...current.draft, renamedSubject: iri } },
    );

  return {
    canCreate,
    choices,
    nodeShapes,
    draft: state?.draft,
    start,
    commit,
    cancel,
    renameSubject,
  };
}
