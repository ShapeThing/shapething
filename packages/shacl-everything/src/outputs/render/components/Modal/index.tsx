import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import type { RdfStore } from "rdf-stores";
import { Close } from "@/helpers/icons.tsx";
import { Localized } from "@fluent/react";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { undoRedoScopeContext } from "@/outputs/render/contexts/undoRedoScopeContext.tsx";
import "./style.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  // The reactive store this modal's own content edits, if it's a staging graph separate from the
  // outer form's (see AutoCompleteEditor/InstancesSelectEditor's create-new flow,
  // AutoCompleteOption's edit-in-place flow) - wires Ctrl+Z/Ctrl+Y to that graph's own undo/redo
  // history (see helpers/reactiveRdfStore.ts) scoped to this dialog, so it doesn't leak out to (or
  // get shadowed by) the outer form's own Ctrl+Z handling for the live dataGraph. Omit when this
  // modal's content doesn't edit a graph of its own (e.g. a plain confirmation, or a read-only
  // view-in-place).
  dataGraph?: RdfStore;
};

// A generic modal dialog built on the native <dialog> element - showModal()/close() bring focus
// trapping, Escape-to-close and a ::backdrop for free, so there's no need to hand-roll those.
export default function Modal({ open, onClose, title, children, dataGraph }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { enableUndoRedo } = useEnvironment();
  const undoRedoScope = useContext(undoRedoScopeContext);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Pushed for as long as this modal is actually open and editing a graph of its own - popped on
  // close/unmount, so EditModeWrapper's single Ctrl+Z/Ctrl+Y listener (see undoRedoScopeContext)
  // falls back to the outer form's own dataGraph again once nothing here needs the override.
  useEffect(() => {
    if (!undoRedoScope || !dataGraph || !open) return;
    return undoRedoScope.push({ dataGraph, enabled: enableUndoRedo ?? true });
  }, [undoRedoScope, dataGraph, open, enableUndoRedo]);

  return (
    <dialog
      ref={dialogRef}
      className="st-modal"
      aria-labelledby={titleId}
      // "close" and "cancel" don't natively bubble, but React simulates bubbling for them through
      // the *React* tree regardless (not the DOM tree, so portaling this component wouldn't help
      // either) - when a Modal is opened from inside another Modal's content (e.g. LabelViewer's
      // view-in-place drilling into a nested IRI), the inner dialog's own native event would
      // otherwise also invoke the outer Modal's onClose/onCancel. Guard on the real event target,
      // exactly like the backdrop-click check below, so each Modal only reacts to its own dialog.
      onClose={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      // Escape's native default action is to close the dialog immediately, then fire "close" -
      // by then `onClose` would run after the fact, too late for a caller that wants a chance to
      // block the close (e.g. to confirm discarding unsaved changes) the same way it already can
      // for the header button/backdrop below. Preventing "cancel" stops that default action, so
      // Escape instead funnels through the exact same pre-close `onClose` call as the other two.
      onCancel={(event) => {
        if (event.target !== dialogRef.current) return;
        event.preventDefault();
        onClose();
      }}
      // A click landing directly on the <dialog> element (rather than bubbling up from
      // .st-modal__content) is a click on its ::backdrop - the standard way to detect that,
      // since the backdrop pseudo-element isn't a reachable event target of its own.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="st-modal__content">
        <header className="st-modal__header">
          <h2 id={titleId} className="st-modal__title">
            {title}
          </h2>
          <Localized id="modal-close" attrs={{ "aria-label": true }}>
            <button type="button" className="st-icon-button" aria-label="Close" onClick={onClose}>
              <Close />
            </button>
          </Localized>
        </header>
        {children}
      </div>
    </dialog>
  );
}
