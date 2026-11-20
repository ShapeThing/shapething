import type { NamedNode, Quad } from "@rdfjs/types";
import { rdf } from "@shapething/shacl-renderer";
import { useState } from "react";
import { Link } from "react-router";
import { useCommit, useDataModel } from "../../data-model/dataModelContext.ts";
import { mintIri } from "../../data-model/editGraphs.ts";
import type { DataModel } from "../../data-model/loadDataModel.ts";
import { factory, type Resource } from "../../data-model/rdf.ts";
import { termToSegment } from "../../data-model/segments.ts";
import type { ShapeSource } from "../rendererProps.ts";
import { EditDialog } from "./EditDialog.tsx";
import { NEW } from "./routes.ts";
import { useRouteDialog } from "./useRouteDialog.ts";

type CreateButtonProps = ShapeSource & {
  // The button reads "New {label}".
  label: string;
  // The first word of the minted IRI's local name.
  kind: string;
  type: NamedNode;
  // Triples tying the new node to its parent, for a node that only exists through one.
  links?: (node: NamedNode) => Quad[];
  // The create route, and where closing it leads when it was opened by a link or a reload.
  path?: string;
  back?: string;
  // The new node's page, from its URL segment.
  to: (segment: string) => string;
};

export function CreateButton({
  label,
  kind,
  type,
  links,
  path = NEW,
  back,
  to,
  ...shape
}: CreateButtonProps) {
  const dialog = useRouteDialog(path, back);
  const dataModel = useDataModel();
  const commit = useCommit();

  // A fresh IRI every time the create route opens.
  const [node, setNode] = useState<NamedNode>();
  if (dialog.open && !node) setNode(mintIri(dataModel, kind));
  if (!dialog.open && node) setNode(undefined);

  const onSubmit = (next: DataModel, created: Resource) => {
    commit(next);
    dialog.leaveTo(to(termToSegment(created, next)));
  };

  return (
    <>
      <Link className="st-button st-button-small" {...dialog.link}>
        New {label}
      </Link>
      {node && (
        <EditDialog
          {...shape}
          title={`New ${label}`}
          open={dialog.open}
          onClose={dialog.close}
          term={node}
          startingQuads={[factory.quad(node, rdf("type"), type), ...(links?.(node) ?? [])]}
          isNew
          onSubmit={onSubmit}
        />
      )}
    </>
  );
}
