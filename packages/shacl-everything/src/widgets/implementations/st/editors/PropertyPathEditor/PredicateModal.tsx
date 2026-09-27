import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { NamedNode, Term } from "@rdfjs/types";
import { Localized } from "@fluent/react";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh, st } from "@/helpers/namespaces.ts";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import FormElement from "@/outputs/render/components/FormElement/index.tsx";
import IRIEditor from "@/widgets/implementations/shui/editors/IRIEditor/widget.tsx";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

type Props = {
  shape: PropertyUIElement;
  onClose: () => void;
  onPick: (predicate: NamedNode) => void;
  // The predicate being edited; absent when adding a new step.
  initial?: NamedNode;
};

// Asks for the predicate of a new path step. Reuses IRIEditor as-is, so the suggestions (IRIs
// already in use + LOV by prefix) are exactly the ones every other IRI field offers. Mounted only
// while open, so every add starts from an empty field and every edit from the current predicate.
export default function PredicateModal({ shape, onClose, onPick, initial }: Props) {
  const [predicate, setPredicate] = useState<Term>(() => initial ?? factory.namedNode(""));
  const predicateShape = useMemo(() => syntheticPredicateShape(shape), [shape]);
  const labelId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  // IRIEditor's own autoFocus runs before Modal's effect has called showModal(), while the dialog
  // is still hidden, so it can't take focus. This effect runs after Modal's.
  // When editing, IRIEditor starts collapsed to the current value's label; clicking that is its own
  // way into the input (and focuses it), so an edit opens straight into the full IRI.
  useEffect(() => {
    const content = contentRef.current;
    const input = content?.querySelector("input");
    if (input) input.focus();
    else content?.querySelector<HTMLElement>(".st-iri-editor__display")?.click();
  }, []);

  // IRIEditor commits typed text on blur, which a mousedown on this button triggers before its
  // click lands - so the button can't be disabled while empty, or that mousedown would never blur.
  const submit = () => {
    if (predicate.termType !== "NamedNode" || !predicate.value) return;
    onPick(predicate);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        initial ? (
          <Localized id="property-path-editor-edit-title">Edit path item</Localized>
        ) : (
          <Localized id="property-path-editor-add-title">Add path item</Localized>
        )
      }
    >
      <div ref={contentRef} className="st-predicate-modal">
        <FormElement
          labelId={labelId}
          label={<Localized id="property-path-editor-add-predicate-label">Predicate</Localized>}
        >
          <IRIEditor
            shape={predicateShape}
            term={predicate}
            setTerm={setPredicate}
            labelledBy={labelId}
          />
        </FormElement>
        <div className="st-predicate-modal__actions">
          <button type="button" className="st-button st-button--text" onClick={onClose}>
            <Localized id="property-path-editor-add-cancel">Cancel</Localized>
          </button>
          <button type="button" className="st-button st-button--primary" onClick={submit}>
            <Localized id="property-path-editor-add-save">Save</Localized>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// IRIEditor reads its constraints from the property shape it's given, and the sh:path property's
// own shape describes the path value, not one predicate inside it. This stands in for "a predicate
// IRI": st:iriType rdf:Property scopes LOV suggestions to properties. Its shapes graph holds only
// this shape, so "Already in use" comes from the dataGraph - where the shapes being edited live.
function syntheticPredicateShape(shape: PropertyUIElement): PropertyUIElement {
  const shapesGraph = RdfStore.createDefault();
  const shapeNode = factory.blankNode();
  shapesGraph.addQuad(factory.quad(shapeNode, sh("nodeKind"), sh("IRI")));
  shapesGraph.addQuad(factory.quad(shapeNode, st("iriType"), rdf("Property")));

  return new PropertyUIElement({
    shapesGraph,
    dataGraph: shape.dataGraph,
    scoresGraph: shape.scoresGraph,
    widgetRegistry: shape.widgetRegistry,
    focusNode: factory.blankNode(),
    propertyShapes: [shapeNode as unknown as NamedNode],
  });
}
