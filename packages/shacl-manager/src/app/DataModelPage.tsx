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

// At the top of the sidebar: the data model's name, leading to its page.
export function DataModelLink() {
  const { dataModelIRI } = useDataModel();
  const termLabel = useTermLabel();
  return (
    <NavLink to={DATA_MODEL_PATH} className="st-manager__data-model">
      <span className="st-manager__data-model-kind">Data model</span>
      <span className="st-manager__data-model-label">{termLabel(dataModelIRI)}</span>
    </NavLink>
  );
}
