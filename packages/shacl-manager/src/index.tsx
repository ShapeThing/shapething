import type { NamedNode } from "@rdfjs/types";
import { Suspense, use, useState, type ReactNode } from "react";
import { RouterProvider } from "react-router";
import { createShaclManagerRouter } from "./app/router.tsx";
import { DataModelContext } from "./data-model/dataModelContext.ts";
import { loadDataModel, type DataModel, type LoadGraph } from "./data-model/loadDataModel.ts";

export type { LoadGraph, DataModel } from "./data-model/loadDataModel.ts";
export { clearImportCache } from "./data-model/importCache.ts";

export type ShaclManagerProps = {
  dataModelIRI: NamedNode;
  loadGraph: LoadGraph;
  fallback?: ReactNode;
};

export function ShaclManager({
  dataModelIRI,
  loadGraph,
  fallback = "Loading…",
}: ShaclManagerProps) {
  // The load is started here, outside the Suspense boundary: a component that suspends before it
  // ever mounted loses its state, so a promise created inside DataModelView would be recreated on
  // every retry and never settle. A different data model (or loader) starts a fresh load.
  const [load, setLoad] = useState(() => ({
    dataModelIRI,
    loadGraph,
    promise: loadDataModel(dataModelIRI, loadGraph),
  }));
  if (load.dataModelIRI.value !== dataModelIRI.value || load.loadGraph !== loadGraph) {
    setLoad({ dataModelIRI, loadGraph, promise: loadDataModel(dataModelIRI, loadGraph) });
  }

  return (
    <Suspense fallback={fallback}>
      <DataModelView key={load.dataModelIRI.value} dataModelPromise={load.promise} />
    </Suspense>
  );
}

function DataModelView({ dataModelPromise }: { dataModelPromise: Promise<DataModel> }) {
  const dataModel = use(dataModelPromise);
  const { dataModelIRI, store, importedGraphIRIs, cachedGraphIRIs, unresolvableGraphIRIs } =
    dataModel;

  const [router] = useState(createShaclManagerRouter);

  return (
    <div className="st-manager-root">
      <div>
        Loaded {store.size} quads from &lt;{dataModelIRI.value}&gt; and {importedGraphIRIs.length}{" "}
        imports ({cachedGraphIRIs.length} from cache, {unresolvableGraphIRIs.length} unresolvable)
      </div>
      <DataModelContext value={dataModel}>
        <RouterProvider router={router} />
      </DataModelContext>
    </div>
  );
}
