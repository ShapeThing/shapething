import type { Quad } from "@rdfjs/types";
import { ShaclRenderer } from "@shapething/shacl-renderer";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDataModel } from "../../data-model/dataModelContext.ts";
import { commitEdit, editDataGraph, importedQuads } from "../../data-model/editGraphs.ts";
import type { DataModel } from "../../data-model/loadDataModel.ts";
import type { Resource } from "../../data-model/rdf.ts";
import { useRendererProps, type ShapeSource } from "../rendererProps.ts";

type EditFormProps = ShapeSource & {
  term: Resource;
  // A new node's starting triples, only committed when the form is submitted.
  startingQuads?: Quad[];
  // A new node gets an identifier field, so the minted IRI can be replaced.
  isNew?: boolean;
  onSubmit: (next: DataModel, term: Resource) => void;
};

type EditDialogProps = EditFormProps & {
  title: ReactNode;
  open: boolean;
  onClose: () => void;
};

// The form is only mounted while open: every opening starts from the data model as it is then.
export function EditDialog({ title, open, onClose, onSubmit, ...form }: EditDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Hidden as soon as the form is submitted, without waiting for the edited data model to load.
  const [submitted, setSubmitted] = useState(false);
  if (!open && submitted) setSubmitted(false);
  const shown = open && !submitted;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (shown && !dialog?.open) dialog?.showModal();
    if (!shown && dialog?.open) dialog.close();
  }, [shown]);

  return (
    <dialog
      ref={dialogRef}
      className="st-modal st-modal--large st-edit-dialog"
      // The renderer's own modals are <dialog>s too, and their close events bubble up to here.
      onClose={(event) => event.target === dialogRef.current && shown && onClose()}
    >
      <div className="st-modal__content">
        <header className="st-modal__header">
          <h2 className="st-modal__title">{title}</h2>
          <button type="button" className="st-icon-button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        {shown && (
          <EditForm
            {...form}
            onSubmit={(next, term) => {
              setSubmitted(true);
              onSubmit(next, term);
            }}
          />
        )}
      </div>
    </dialog>
  );
}

function EditForm({ term, startingQuads, isNew, onSubmit, ...shape }: EditFormProps) {
  const dataModel = useDataModel();
  const rendererProps = useRendererProps(shape);
  const [dataGraph] = useState(() => editDataGraph(dataModel, startingQuads));
  const [readOnlyGraph] = useState(() => importedQuads(dataModel));

  return (
    <ShaclRenderer
      {...rendererProps}
      mode="edit"
      dataGraph={dataGraph}
      readOnlyGraph={readOnlyGraph}
      focusNode={term}
      enableFocusNodeEditor={isNew}
      onSubmit={(result) =>
        onSubmit(commitEdit(dataModel, result.dataGraph), result.focusNode ?? term)
      }
    />
  );
}
