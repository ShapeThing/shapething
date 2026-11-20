import type { NamedNode } from "@rdfjs/types";
import { LocalStore } from "@shapething/localstore";
import { ShaclManager } from "@shapething/shacl-manager";
import { DataFactory } from "n3";
import { Suspense, use, useMemo, useState } from "react";
import {
  dataModelSource,
  fileLabel,
  folderBase,
  listDataModels,
  openFolder,
  type DataModelFile,
  type Folder,
} from "./folder.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { GitPanel } from "./GitPanel.tsx";

// The folder and data model are kept in the query string; the hash belongs to the manager.
const readParam = (name: string) => new URLSearchParams(location.search).get(name) ?? undefined;

// graph is the file, iri the data model it holds: only needed until a new data model is saved.
function writeParams(params: { folder?: string; graph?: string; iri?: string }) {
  const search = new URLSearchParams();
  if (params.folder) search.set("folder", params.folder);
  if (params.graph) search.set("graph", params.graph);
  if (params.iri) search.set("iri", params.iri);
  const query = search.size ? `?${search}` : "";
  history.replaceState(
    null,
    "",
    `${location.pathname}${query}${params.graph ? location.hash : ""}`,
  );
}

const supported = typeof globalThis.showDirectoryPicker === "function";

// Reopens the folder of the last visit, when the browser still has permission for it.
const initialFolder = (() => {
  const name = readParam("folder");
  return name && supported
    ? openFolder(name, { interactive: false }).catch(() => undefined)
    : Promise.resolve(undefined);
})();

export function App() {
  return (
    <Suspense fallback={<div className="app-message">Loading…</div>}>
      <Shell />
    </Suspense>
  );
}

function Shell() {
  const [folder, setFolder] = useState<Folder | undefined>(use(initialFolder));
  const [error, setError] = useState<string>();

  const open = async (name?: string) => {
    setError(undefined);
    const opened = await openFolder(name, { interactive: true }).catch((error: unknown) => {
      setError(String(error));
      return undefined;
    });
    if (!opened) return;
    writeParams({ folder: opened.name });
    setFolder(opened);
  };

  const close = () => {
    writeParams({});
    setFolder(undefined);
  };

  if (!folder) return <FolderPicker onOpen={open} error={error} />;
  return <Workspace key={folder.name} folder={folder} onClose={close} />;
}

const mountsPromise = supported ? LocalStore.listMounts().catch(() => []) : Promise.resolve([]);

function FolderPicker({ onOpen, error }: { onOpen: (name?: string) => void; error?: string }) {
  const mounts = use(mountsPromise);
  const last = readParam("folder");

  return (
    <div className="app-start">
      <h1 className="app-start__title">
        <img src="/logo.svg" alt="" className="app-logo" /> SHACL Manager
      </h1>
      <p>
        Edit the SHACL shapes and OWL ontologies in a folder on your computer. Nothing leaves your
        machine, the Turtle files are read and written in place. When the folder is a git
        repository, the changes can be committed and pushed from here.
      </p>
      {!supported ? (
        <p className="app-error">
          This browser can't open folders on your computer. Use a Chromium based browser, such as
          Chrome or Edge.
        </p>
      ) : (
        <>
          <button type="button" className="st-button st-button--primary" onClick={() => onOpen()}>
            Open a folder…
          </button>
          {mounts.length > 0 && (
            <section className="app-start__recent">
              <h2>Recent folders</h2>
              <ul>
                {mounts.map((name) => (
                  <li key={name}>
                    <button type="button" className="st-button" onClick={() => onOpen(name)}>
                      {name}
                      {name === last && " (last opened)"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {error && <p className="app-error">{error}</p>}
    </div>
  );
}

// The chosen file, with the IRI asked for when it is a new data model.
type Selection = { file: NamedNode; iri?: NamedNode };

function Workspace({ folder, onClose }: { folder: Folder; onClose: () => void }) {
  const [modelsPromise, setModelsPromise] = useState(() => listDataModels(folder));
  const [selection, setSelection] = useState<Selection | undefined>(() => {
    const file = readParam("graph");
    const iri = readParam("iri");
    return file
      ? { file: DataFactory.namedNode(file), iri: iri ? DataFactory.namedNode(iri) : undefined }
      : undefined;
  });
  // Bumped on every save, so the git panel looks at the files again.
  const [saves, setSaves] = useState(0);

  const select = (next?: Selection) => {
    writeParams({ folder: folder.name, graph: next?.file.value, iri: next?.iri?.value });
    // Back at the list: files may have been added or declare another IRI by now.
    if (!next) setModelsPromise(listDataModels(folder));
    setSelection(next);
  };

  return (
    <div className="app">
      <header className="app-bar">
        <img src="/logo.svg" alt="" className="app-logo" />
        <span className="app-bar__folder" title="The connected folder">
          {folder.name}
        </span>
        {selection && (
          <button type="button" className="st-button app-bar__graph" onClick={() => select()}>
            {fileLabel(selection.file, folder.name)}
          </button>
        )}
        <span className="app-bar__spacer" />
        {folder.repository && <GitPanel repository={folder.repository} refresh={saves} />}
        <button type="button" className="st-button" onClick={onClose}>
          Close folder
        </button>
      </header>
      {selection ? (
        <ErrorBoundary
          key={selection.file.value}
          fallback={(error) => (
            <div className="app-start">
              <p className="app-error">
                Could not open {fileLabel(selection.file, folder.name)}: {String(error)}
              </p>
              <button type="button" className="st-button" onClick={() => select()}>
                Choose another data model
              </button>
            </div>
          )}
        >
          <Suspense fallback={<div className="app-message">Reading the folder…</div>}>
            <Manager
              folder={folder}
              modelsPromise={modelsPromise}
              selection={selection}
              onSaved={() => setSaves((saves) => saves + 1)}
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <Suspense fallback={<div className="app-message">Reading the folder…</div>}>
          <GraphPicker folder={folder} modelsPromise={modelsPromise} onSelect={select} />
        </Suspense>
      )}
    </div>
  );
}

type GraphPickerProps = {
  folder: Folder;
  modelsPromise: Promise<DataModelFile[]>;
  onSelect: (selection: Selection) => void;
};

function GraphPicker({ folder, modelsPromise, onSelect }: GraphPickerProps) {
  const models = use(modelsPromise);

  return (
    <div className="app-start">
      <h2>Choose the data model to edit</h2>
      {models.length === 0 ? (
        <p>There are no Turtle (.ttl) files in this folder yet.</p>
      ) : (
        <ul className="app-graphs">
          {models.map(({ file, title }) => (
            <li key={file.value}>
              <button type="button" className="st-button" onClick={() => onSelect({ file })}>
                <span>{fileLabel(file, folder.name)}</span>
                {title && <span className="app-graphs__title">{title}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="app-new-model"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const name = (data.get("name") as string).replace(/\.ttl$/, "");
          onSelect({
            file: DataFactory.namedNode(folderBase(folder.name) + encodeURI(name)),
            iri: DataFactory.namedNode(data.get("iri") as string),
          });
        }}
      >
        <h3>New data model</h3>
        <p className="app-hint">
          Starts empty. The file is created in this folder when you first save.
        </p>
        <label htmlFor="new-model">File</label>
        <input
          id="new-model"
          name="name"
          className="st-input"
          required
          pattern="[\w.\/\-]+"
          placeholder="model.ttl"
        />
        <label htmlFor="new-model-iri">IRI</label>
        <input
          id="new-model-iri"
          name="iri"
          className="st-input"
          type="url"
          required
          placeholder="https://example.com/def/model"
        />
        <button type="submit" className="st-button st-button--primary">
          Create
        </button>
      </form>
    </div>
  );
}

type ManagerProps = {
  folder: Folder;
  modelsPromise: Promise<DataModelFile[]>;
  selection: Selection;
  onSaved: () => void;
};

function Manager({ folder, modelsPromise, selection, onSaved }: ManagerProps) {
  const models = use(modelsPromise);
  // An existing file decides its own IRI; a new one has the IRI it was created with.
  const model = useMemo(
    () =>
      models.find(({ file }) => file.equals(selection.file)) ?? {
        file: selection.file,
        iri: selection.iri ?? selection.file,
      },
    [models, selection],
  );
  const source = useMemo(() => dataModelSource(folder, model, models), [folder, model, models]);

  return (
    <ShaclManager
      dataModelIRI={model.iri}
      loadGraph={source.loadGraph}
      onSubmit={async (changes) => {
        await source.save(changes);
        onSaved();
      }}
    />
  );
}
