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

type EditButtonProps = ShapeSource & {
  term: Resource;
  // The node's page, relative to the calling component's route: its edit route is below it.
  at?: string;
  small?: boolean;
};

export function EditButton({ term, at = ".", small, ...shape }: EditButtonProps) {
  // Opened from a list, the page before may be another item's: closing goes to the edited one.
  const dialog = useRouteDialog(`${at}/${EDIT}`, at, true);
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
      <Link className={small ? "st-button st-button-small" : "st-button"} {...dialog.link}>
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
