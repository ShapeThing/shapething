import { owl, rdf, sh } from "@shapething/shacl-renderer";
import { NavLink, type RouteObject } from "react-router";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { factory } from "../data-model/rdf.ts";
import { editRoute } from "./edit/routes.ts";
import { metaShapes, MetaView } from "./MetaView.tsx";
import dataModelLayout from "./shapes/dataModel.edit.ttl?raw";
import dataModel from "./shapes/dataModel.ttl?raw";
import { useTermLabel } from "./termLabel.ts";

export const DATA_MODEL_PATH = "/data-model";

const dataModelMeta = metaShapes(
  dataModel,
  dataModelLayout,
  "http://shapething.com/shacl-manager/data-model-meta#dataModel",
);

// The data model itself: what it is called and what it imports. A data model that is not typed
// yet, such as a new one, becomes an owl:Ontology and sh:ShapesGraph when it is first edited.
function DataModelPage() {
  const { dataModelIRI, store } = useDataModel();
  const typed = store.countQuads(dataModelIRI, rdf("type"), null, dataModelIRI) > 0;
  const startingQuads = typed
    ? undefined
    : [owl("Ontology"), sh("ShapesGraph")].map((type) =>
        factory.quad(dataModelIRI, rdf("type"), type),
      );

  return (
    <section className="st-section">
      <MetaView
        term={dataModelIRI}
        shapes={dataModelMeta}
        heading={{ type: "Data model" }}
        actions={{ edit: { shapes: dataModelMeta.edit, startingQuads } }}
      />
    </section>
  );
}

export const dataModelRoute: RouteObject = {
  path: DATA_MODEL_PATH.slice(1),
  element: <DataModelPage />,
  children: [editRoute],
};

// At the top of the sidebar: the data model's name, and a cog leading to its page.
export function DataModelHeader() {
  const { dataModelIRI } = useDataModel();
  const termLabel = useTermLabel();
  return (
    <div className="st-manager__data-model">
      <div className="st-manager__data-model-text">
        <span className="st-manager__data-model-kind">Data model</span>
        <span className="st-manager__data-model-label" title={dataModelIRI.value}>
          {termLabel(dataModelIRI)}
        </span>
      </div>
      <NavLink
        to={DATA_MODEL_PATH}
        className="st-manager__icon-button"
        aria-label="Data model settings"
        title="Data model settings"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
          <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
        </svg>
      </NavLink>
    </div>
  );
}
