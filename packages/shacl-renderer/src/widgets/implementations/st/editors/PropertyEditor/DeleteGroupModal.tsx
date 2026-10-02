import { useMemo } from "react";
import { createPortal } from "react-dom";
import { Localized } from "@fluent/react";
import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { termKey } from "@/helpers/termKey.ts";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import {
  displayName,
  useRowLabel,
} from "@/widgets/implementations/st/editors/PropertyEditor/labels.ts";
import { deleteGroup, shapesUsingGroup } from "@/widgets/implementations/st/editors/PropertyEditor/tree.ts";

function ShapeName({ shape, dataGraph }: { shape: Quad_Subject; dataGraph: RdfStore }) {
  return <li>{displayName(shape, useRowLabel(shape, dataGraph))}</li>;
}

/**
 * Asks before deleting a group (see tree.ts's deleteGroup) - and names the other shapes that use
 * it, since deleting it takes their properties out of it too.
 */
export default function DeleteGroupModal({
  group,
  name,
  shape,
  dataGraph,
  onClose,
}: {
  group: Quad_Subject;
  name: string;
  // The node shape being edited - not listed among the others.
  shape: Term;
  dataGraph: RdfStore;
  onClose: () => void;
}) {
  const otherShapes = useMemo(
    () => shapesUsingGroup(group, dataGraph, shape),
    [group, dataGraph, shape],
  );

  // Portaled like DraftModal, out of the page's own edit <form>.
  return createPortal(
    <Modal
      open
      onClose={onClose}
      title={<Localized id="property-editor-delete-group-title">Delete group?</Localized>}
    >
      <div className="st-property-editor__delete-modal">
        <p>
          <Localized id="property-editor-delete-group-message" vars={{ label: name }}>
            {`Delete ${name}? What is in it will no longer be in a group.`}
          </Localized>
        </p>
        {otherShapes.length > 0 && (
          <>
            <p>
              <Localized
                id="property-editor-delete-group-used-by"
                vars={{ count: otherShapes.length }}
              >
                {"It is also used by these other shapes:"}
              </Localized>
            </p>
            <ul className="st-property-editor__delete-shapes">
              {otherShapes.map((other) => (
                <ShapeName key={termKey(other)} shape={other} dataGraph={dataGraph} />
              ))}
            </ul>
          </>
        )}
        <div className="st-property-editor__draft-actions">
          <button type="button" className="st-button st-button--text" onClick={onClose}>
            <Localized id="property-editor-delete-group-cancel">Cancel</Localized>
          </button>
          <button
            type="button"
            className="st-button st-button--danger"
            onClick={() => {
              deleteGroup(group, dataGraph);
              onClose();
            }}
          >
            <Localized id="property-editor-delete-group-confirm">Delete</Localized>
          </button>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
