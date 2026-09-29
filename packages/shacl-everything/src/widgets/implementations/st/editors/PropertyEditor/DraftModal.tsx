import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Localized } from "@fluent/react";
import type { Quad } from "@rdfjs/types";
import type { StagingGraph } from "@/helpers/stagingGraph.ts";
import Modal from "@/outputs/render/components/Modal/index.tsx";
import NodeUIElementChildren from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
import type { NodeUIElement } from "@/structure/NodeUIElement.ts";

/**
 * A property shape or group opened in the PropertyEditor's modal - an existing one to edit, or a
 * new one to create. Edited on a StagingGraph, so nothing is written until it is submitted.
 */
export type Draft = {
  title: ReactNode;
  // "Update" for an existing node, like every other edit-in-place modal; "Save" for a new one.
  submitLabel: ReactNode;
  // Plain-text name for the discard prompt.
  label: string;
  staging: StagingGraph;
  node: NodeUIElement;
  // Writes the staged changes (and, for a new node, whatever links it in) as one undo step.
  save: () => void;
};

const changeKeys = (staging: StagingGraph) => {
  const { additions, deletions } = staging.changes();
  const key = (quad: Quad) => [quad.subject, quad.predicate, quad.object].map((t) => t.value);
  return JSON.stringify([additions.map(key).sort(), deletions.map(key).sort()]);
};

export default function DraftModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  // A new node's staging graph starts out seeded (its rdf:type, its sh:order) - those aren't the
  // user's edits, so only changes beyond them ask before being thrown away.
  const [untouched] = useState(() => changeKeys(draft.staging));
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = () => {
    if (changeKeys(draft.staging) === untouched) onClose();
    else setConfirmDiscard(true);
  };

  // Portaled with a <form> of its own: rendered inline it would sit inside the page's own edit
  // <form>, where a nested one isn't allowed (see ResourceEditButton).
  return createPortal(
    <>
      <Modal
        open
        onClose={requestClose}
        title={draft.title}
        size="large"
        dataGraph={draft.staging.dataGraph}
      >
        <form
          className="st-property-editor__draft-form"
          onSubmit={(event) => {
            event.preventDefault();
            draft.save();
            onClose();
          }}
        >
          <NodeUIElementChildren nodeUiElement={draft.node} autoFocusFirst />
          <div className="st-property-editor__draft-actions">
            <button type="submit" className="st-button st-button--primary">
              {draft.submitLabel}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={<Localized id="autocomplete-option-discard-title">Discard changes?</Localized>}
      >
        <p>
          <Localized id="autocomplete-option-discard-message" vars={{ label: draft.label }}>
            {`Discard your changes to ${draft.label}? This cannot be undone.`}
          </Localized>
        </p>
        <div className="st-property-editor__draft-actions">
          <button
            type="button"
            className="st-button st-button--text"
            onClick={() => setConfirmDiscard(false)}
          >
            <Localized id="autocomplete-option-discard-cancel">Keep editing</Localized>
          </button>
          <button type="button" className="st-button st-button--danger" onClick={onClose}>
            <Localized id="autocomplete-option-discard-confirm">Discard</Localized>
          </button>
        </div>
      </Modal>
    </>,
    document.body,
  );
}
