import type { NamedNode } from "@rdfjs/types";
import type { BCP47 } from "@shapething/shacl-renderer";
import {
  startTransition,
  Suspense,
  use,
  useImperativeHandle,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
  type Ref,
} from "react";
import { RouterProvider } from "react-router";
import "@shapething/shacl-renderer/style.css";
import { createShaclManagerRouter } from "./app/router.tsx";
import { LanguagesContext } from "./app/termLabel.ts";
import { CommitContext, DataModelContext, SaveContext } from "./data-model/dataModelContext.ts";
import {
  changesSince,
  commitEdit,
  ownGraph,
  withChanges,
  type Changes,
} from "./data-model/editGraphs.ts";
import {
  loadDataModel,
  ownImports,
  reloadImports,
  type DataModel,
  type LoadGraph,
} from "./data-model/loadDataModel.ts";

export type { LoadGraph, DataModel } from "./data-model/loadDataModel.ts";
export type { Changes } from "./data-model/editGraphs.ts";
export { clearImportCache } from "./data-model/importCache.ts";

// For a host that asks for the changes itself, e.g. from its own save button.
export type ShaclManagerHandle = {
  // The additions and deletions in the data model's own graph since it was loaded or last saved.
  getChanges(): Changes;
  // Tells the manager the changes were saved: they no longer count as pending.
  markSaved(): void;
};

export type ShaclManagerProps = {
  dataModelIRI: NamedNode;
  loadGraph: LoadGraph;
  fallback?: ReactNode;
  // Most preferred first; the browser's by default.
  languages?: BCP47[];
  // Shows a save button. Return a promise to have the changes marked saved when it resolves;
  // otherwise call markSaved() once they are.
  onSubmit?: (changes: Changes) => void | Promise<unknown>;
  ref?: Ref<ShaclManagerHandle>;
};

export function ShaclManager({
  dataModelIRI,
  loadGraph,
  fallback = "Loading…",
  languages = navigatorLanguages(),
  onSubmit,
  ref,
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
          loadGraph={load.loadGraph}
          onSubmit={onSubmit}
          handle={ref}
        />
      </LanguagesContext>
    </Suspense>
  );
}

const navigatorLanguages = (): BCP47[] =>
  typeof navigator === "undefined" ? [] : (navigator.languages as BCP47[]);

type DataModelViewProps = {
  dataModelPromise: Promise<DataModel>;
  loadGraph: LoadGraph;
  onSubmit?: ShaclManagerProps["onSubmit"];
  handle?: Ref<ShaclManagerHandle>;
};

function DataModelView({ dataModelPromise, loadGraph, onSubmit, handle }: DataModelViewProps) {
  const loaded = use(dataModelPromise);
  const [dataModel, setDataModel] = useState(loaded);
  const [saved, setSaved] = useState(() => ownGraph(loaded));
  const [saving, setSaving] = useState(false);
  const changes = useMemo(() => changesSince(saved, dataModel), [saved, dataModel]);

  // In a transition, so the pages stay on screen while the queries over the edited store run. An
  // edit of the own owl:imports first loads what is now imported, and drops what no longer is.
  const [updating, startUpdate] = useTransition();
  const commit = (next: DataModel) =>
    startUpdate(async () => {
      const importsChanged = ownImports(next).join(" ") !== ownImports(dataModel).join(" ");
      const resolved = importsChanged ? await reloadImports(next, loadGraph) : next;
      startTransition(() => setDataModel(resolved));
    });

  useImperativeHandle(
    handle,
    () => ({ getChanges: () => changes, markSaved: () => setSaved(ownGraph(dataModel)) }),
    [changes, dataModel],
  );

  const save = async () => {
    const result = onSubmit?.(changes);
    if (!(result instanceof Promise)) return;
    setSaving(true);
    try {
      await result;
      // Only what was handed out counts as saved, not edits made while saving.
      setSaved((saved) => withChanges(saved, changes));
    } catch (error) {
      // The changes stay pending, to be saved again.
      console.warn("[shacl-manager] Saving the changes failed:", error);
    } finally {
      setSaving(false);
    }
  };

  // Back to the data model as it was loaded or last saved.
  const discard = () => commit(commitEdit(dataModel, saved));

  const [router] = useState(createShaclManagerRouter);
  const pending = changes.additions.length + changes.deletions.length;

  return (
    <div className="st-manager-root">
      <DataModelContext value={dataModel}>
        <CommitContext value={commit}>
          <SaveContext value={{ pending, saving, updating, save: onSubmit && save, discard }}>
            <RouterProvider router={router} />
          </SaveContext>
        </CommitContext>
      </DataModelContext>
    </div>
  );
}
