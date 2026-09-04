import { useMemo, useState } from "react";
import type { NamedNode, Quad, Quad_Subject } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { Plus } from "@/helpers/icons.tsx";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { diffQuads } from "@/helpers/diffQuads.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
import type { WidgetProps } from "@/widgets/types.ts";
import { valueNodeLabel, valueNodeShapes } from "@/resolution/label.ts";
import { shaclInstancesOfClass } from "@/resolution/targets.ts";
import { Localized } from "@fluent/react/esm/localized.js";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
import "./style.css";

// Mirrors AutoCompleteOption's own edit-in-place staging: the new instance is built up against its
// own scratch copy of the whole graph, not `shape.dataGraph` directly, so nothing real is written
// (not even the new subject's own rdf:type) unless the user confirms via Done.
type Staging = { dataGraph: RdfStore; originalQuads: Quad[] };

export default function InstancesSelectEditor({
  shape,
  term,
  setTerm,
  labelledBy,
  autoFocus,
}: WidgetProps) {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { enableCreateInPlace } = useEnvironment();
  const shClasses = shape.get(sh("class"));
  const existingObjects = useDataGraphObjects(shape);

  const subjects = useMemo(() => {
    const seen = new Set<string>();
    const result: Quad_Subject[] = [];
    for (const shClass of shClasses) {
      for (const instance of shaclInstancesOfClass(shClass, shape.dataGraph, shape.shapesGraph)) {
        if (!seen.has(instance.value)) {
          seen.add(instance.value);
          result.push(instance);
        }
      }
    }
    return result.filter(
      (subject) =>
        !existingObjects.some((obj) => obj.value === subject.value && obj.value !== term.value),
    );
  }, [shClasses, shape, existingObjects, term]);

  // The shape describing a newly created instance's own fields (its sh:node, or - failing that -
  // any node shape targeting its sh:class via sh:targetClass, see valueNodeShapes) - absent, the
  // instance can still be created (typed and set as the value), just with no field-editing modal
  // to immediately open, since there'd be nothing to render one against.
  const nodeShapes = useMemo(() => valueNodeShapes(shape), [shape]);
  const [creating, setCreating] = useState<NamedNode | undefined>(undefined);
  const [staging, setStaging] = useState<Staging | undefined>(undefined);

  // Mints a fresh, randomly-identified instance of this property's sh:class(es) - a real
  // identifier is deferred to a future widget on the node shape itself that can edit both blank
  // nodes and IRIs; for now this always creates a NamedNode so InstancesSelectEditor's own
  // isIRI-scored widget selection stays valid for the new value straight away.
  const createNew = () => {
    if (shClasses.length === 0) return;
    const subject = factory.namedNode(`urn:uuid:${crypto.randomUUID()}`);
    // No field-editing modal to stage against - nothing to defer, so create and select it directly.
    if (nodeShapes.length === 0) {
      for (const shClass of shClasses) {
        shape.dataGraph.addQuad(factory.quad(subject, rdf("type"), shClass as NamedNode));
      }
      setTerm(subject);
      return;
    }
    const originalQuads = shape.dataGraph.getQuads();
    const stagingDataGraph = makeReactive(RdfStore.createDefault());
    for (const quad of originalQuads) stagingDataGraph.addQuad(quad);
    for (const shClass of shClasses) {
      stagingDataGraph.addQuad(factory.quad(subject, rdf("type"), shClass as NamedNode));
    }
    setStaging({ dataGraph: stagingDataGraph, originalQuads });
    setCreating(subject);
  };

  // Applies the staged edits - including the new subject's own rdf:type - as real additions to
  // `shape.dataGraph` only now, then adopts it as this property's value.
  const submitCreate = () => {
    if (creating && staging) {
      const { additions, deletions } = diffQuads(
        staging.originalQuads,
        staging.dataGraph.getQuads(),
      );
      for (const quad of deletions) shape.dataGraph.removeQuad(quad);
      for (const quad of additions) shape.dataGraph.addQuad(quad);
      setTerm(creating);
    }
    setCreating(undefined);
    setStaging(undefined);
  };

  // Every other way of dismissing the modal (header close, backdrop, Escape) throws the staged
  // graph away untouched - `shape.dataGraph` was never written to, so there's nothing to undo.
  const cancelCreate = () => {
    setCreating(undefined);
    setStaging(undefined);
  };

  return (
    <>
      <SelectListbox
        ariaLabelledby={labelledBy}
        autoFocus={autoFocus}
        value={term.value}
        options={subjects.map((s) => s.value)}
        onChange={(v) => setTerm(factory.namedNode(v))}
        renderTriggerContent={(v) =>
          v ? (
            valueNodeLabel({
              term: factory.namedNode(v),
              propertyShape: shape,
              languages: [activeInterfaceLanguage],
            }).value
          ) : (
            <Localized id="select-an-option" />
          )
        }
        renderOption={(v) =>
          valueNodeLabel({
            term: factory.namedNode(v),
            propertyShape: shape,
            languages: [activeInterfaceLanguage],
          }).value
        }
        // Always offered when enabled - regardless of whether any existing instances are already
        // available to pick - and visually set apart (see style.css) from the ordinary options
        // above it, since picking it does something categorically different (creates new data)
        // rather than just selecting among what already exists.
        extraRow={
          enableCreateInPlace && shClasses.length > 0
            ? {
                content: (
                  <span className="st-create-option">
                    <Plus />
                    <Localized id="create-new-reference-option">Create new…</Localized>
                  </span>
                ),
                onActivate: createNew,
              }
            : undefined
        }
      />
      {creating && staging && (
        <Modal
          open
          onClose={cancelCreate}
          title={<Localized id="create-new-reference-title">New item</Localized>}
        >
          <NodeUIElementChildren
            nodeUiElement={
              new NodeUIElement({
                shapesGraph: shape.shapesGraph,
                dataGraph: staging.dataGraph,
                scoresGraph: shape.scoresGraph,
                widgetRegistry: shape.widgetRegistry,
                focusNode: creating,
                nodeShapes,
              })
            }
          />
          <div className="st-instances-select-editor__create-actions">
            <button type="button" className="st-button st-button--primary" onClick={submitCreate}>
              <Localized id="create-new-reference-done">Done</Localized>
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
