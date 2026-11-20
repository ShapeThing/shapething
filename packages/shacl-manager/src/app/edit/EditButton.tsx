import { Link } from "react-router";
import { useCommit, useDataModel } from "../../data-model/dataModelContext.ts";
import type { DataModel } from "../../data-model/loadDataModel.ts";
import type { Resource } from "../../data-model/rdf.ts";
import { termToSegment } from "../../data-model/segments.ts";
import type { ShapeSource } from "../rendererProps.ts";
import { useTermLabel } from "../termLabel.ts";
import { EditDialog } from "./EditDialog.tsx";
import { EDIT } from "./routes.ts";
import { safeDecode, useRouteDialog } from "./useRouteDialog.ts";

// Must be rendered by the page's own route element, so "edit" resolves under it.
export function EditButton({ term, ...shape }: ShapeSource & { term: Resource }) {
  const dialog = useRouteDialog(EDIT);
  const dataModel = useDataModel();
  const commit = useCommit();
  const termLabel = useTermLabel();

  // A blank node's URL segment is a hash of its content, which the edit changed.
  const onSubmit = (next: DataModel) => {
    commit(next);
    const from = termToSegment(term, dataModel);
    const to = termToSegment(term, next);
    if (term.termType === "BlankNode" && from !== to) {
      dialog.leaveTo(replaceSegment(dialog.backTo, from, to));
    } else {
      dialog.close();
    }
  };

  return (
    <>
      <Link className="st-button" {...dialog.link}>
        Edit
      </Link>
      <EditDialog
        {...shape}
        title={`Edit ${termLabel(term)}`}
        open={dialog.open}
        onClose={dialog.close}
        term={term}
        onSubmit={onSubmit}
      />
    </>
  );
}

function replaceSegment(pathname: string, from: string, to: string): string {
  return pathname
    .split("/")
    .map((part) => (safeDecode(part) === from ? encodeURIComponent(to) : part))
    .join("/");
}
