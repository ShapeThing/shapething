import { useRef } from "react";
import { useNavigate } from "react-router";
import { useCommit, useDataModel } from "../../data-model/dataModelContext.ts";
import { deleteNode, isOwn } from "../../data-model/editGraphs.ts";
import type { Resource } from "../../data-model/rdf.ts";
import { useTermLabel } from "../termLabel.ts";

// Deletes a node of the data model's own graph, after asking. Its page is gone then: this goes up
// to the route above it, e.g. the list it was in.
export function DeleteButton({ term }: { term: Resource }) {
  const dataModel = useDataModel();
  const commit = useCommit();
  const navigate = useNavigate();
  const termLabel = useTermLabel();
  const dialog = useRef<HTMLDialogElement>(null);
  if (!isOwn(dataModel, term)) return null;

  const remove = () => {
    navigate("..");
    commit(deleteNode(dataModel, term));
  };

  return (
    <>
      <button
        type="button"
        className="st-button st-button--delete"
        onClick={() => dialog.current?.showModal()}
      >
        Delete
      </button>
      <dialog ref={dialog} className="st-modal st-confirm">
        <form method="dialog" className="st-modal__content">
          <header className="st-modal__header">
            <h2 className="st-modal__title">Delete {termLabel(term)}?</h2>
          </header>
          <p>This removes it from the data model, together with the references to it.</p>
          <footer className="st-confirm__actions">
            <button type="submit" className="st-button" autoFocus>
              Cancel
            </button>
            <button type="button" className="st-button st-button--delete" onClick={remove}>
              Delete
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
