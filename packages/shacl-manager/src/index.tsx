import type { NamedNode, Quad } from "@rdfjs/types";
import type { BCP47 } from "@shapething/shacl-renderer";
import { startTransition, Suspense, use, useState, type ReactNode } from "react";
import { RouterProvider } from "react-router";
import "@shapething/shacl-renderer/style.css";
import { createShaclManagerRouter } from "./app/router.tsx";
import { LanguagesContext } from "./app/termLabel.ts";
import { CommitContext, DataModelContext } from "./data-model/dataModelContext.ts";
import { ownQuads } from "./data-model/editGraphs.ts";
import { loadDataModel, type DataModel, type LoadGraph } from "./data-model/loadDataModel.ts";

export type { LoadGraph, DataModel } from "./data-model/loadDataModel.ts";
export { clearImportCache } from "./data-model/importCache.ts";

export type ShaclManagerProps = {
  dataModelIRI: NamedNode;
  loadGraph: LoadGraph;
  fallback?: ReactNode;
  // Most preferred first; the browser's by default.
  languages?: BCP47[];
  // Called after every edit with every quad of the data model's own graph, for the host to save.
  onDataModelChange?: (quads: Quad[]) => void;
};

export function ShaclManager({
  dataModelIRI,
  loadGraph,
  fallback = "Loading…",
  languages = navigatorLanguages(),
  onDataModelChange,
}: ShaclManagerProps) {
  // Started outside the Suspense boundary: a component that suspends before it ever mounted loses
  // its state, so a promise created inside it would be recreated on every retry.
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
      <LanguagesContext value={languages}>
        <DataModelView
          key={load.dataModelIRI.value}
          dataModelPromise={load.promise}
          onDataModelChange={onDataModelChange}
        />
      </LanguagesContext>
    </Suspense>
  );
}

const navigatorLanguages = (): BCP47[] =>
  typeof navigator === "undefined" ? [] : (navigator.languages as BCP47[]);

type DataModelViewProps = {
  dataModelPromise: Promise<DataModel>;
  onDataModelChange?: (quads: Quad[]) => void;
};

function DataModelView({ dataModelPromise, onDataModelChange }: DataModelViewProps) {
  const loaded = use(dataModelPromise);
  // In a transition, so the pages stay on screen while the queries over the edited store run.
  const [dataModel, setDataModel] = useState(loaded);
  const commit = (next: DataModel) => {
    startTransition(() => setDataModel(next));
    onDataModelChange?.(ownQuads(next));
  };

  const [router] = useState(createShaclManagerRouter);

  return (
    <div className="st-manager-root">
      <DataModelContext value={dataModel}>
        <CommitContext value={commit}>
          <RouterProvider router={router} />
        </CommitContext>
      </DataModelContext>
    </div>
  );
}
