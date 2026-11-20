import type { NamedNode } from "@rdfjs/types";
import { LocalStore } from "@shapething/localstore";
import { ShaclManager } from "@shapething/shacl-manager";
import { DataFactory } from "n3";
import { Suspense, use, useMemo, useState } from "react";
import {
  baseIriOf,
  dataModelSource,
  graphLabel,
  listGraphs,
  openFolder,
  setBaseIri,
  type Folder,
} from "./folder.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { GitPanel } from "./GitPanel.tsx";

// The folder and data model are kept in the query string; the hash belongs to the manager.
const readParam = (name: string) => new URLSearchParams(location.search).get(name) ?? undefined;

function writeParams(params: { folder?: string; graph?: string }) {
  const search = new URLSearchParams();
  if (params.folder) search.set("folder", params.folder);
  if (params.graph) search.set("graph", params.graph);
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

function Workspace({ folder, onClose }: { folder: Folder; onClose: () => void }) {
  const [baseIri, setBaseIriState] = useState(() => baseIriOf(folder.name));
  const [graphsPromise, setGraphsPromise] = useState(() => listGraphs(folder));
  const [graph, setGraph] = useState<NamedNode | undefined>(() => {
    const value = readParam("graph");
    return value ? DataFactory.namedNode(value) : undefined;
  });
  // Bumped on every save, so the git panel looks at the files again.
  const [saves, setSaves] = useState(0);

  const selectGraph = (next?: NamedNode) => {
    writeParams({ folder: folder.name, graph: next?.value });
    setGraph(next);
  };

  const changeBaseIri = (value: string) => {
    setBaseIri(folder, value);
    setBaseIriState(value);
    setGraphsPromise(listGraphs(folder));
    selectGraph(undefined);
  };

  return (
    <div className="app">
      <header className="app-bar">
        <img src="/logo.svg" alt="" className="app-logo" />
        <span className="app-bar__folder" title="The connected folder">
          {folder.name}
        </span>
        {graph && (
          <button type="button" className="st-button app-bar__graph" onClick={() => selectGraph()}>
            {graphLabel(graph, baseIri)}
          </button>
        )}
        <span className="app-bar__spacer" />
        {folder.repository && <GitPanel repository={folder.repository} refresh={saves} />}
        <button type="button" className="st-button" onClick={onClose}>
          Close folder
        </button>
      </header>
      {graph ? (
        <ErrorBoundary
          key={`${graph.value} ${baseIri}`}
          fallback={(error) => (
            <div className="app-start">
              <p className="app-error">
                Could not open {graph.value}: {String(error)}
              </p>
              <button type="button" className="st-button" onClick={() => selectGraph()}>
                Choose another data model
              </button>
            </div>
          )}
        >
          <Manager folder={folder} graph={graph} onSaved={() => setSaves((saves) => saves + 1)} />
        </ErrorBoundary>
      ) : (
        <Suspense fallback={<div className="app-message">Reading the folder…</div>}>
          <GraphPicker
            graphsPromise={graphsPromise}
            baseIri={baseIri}
            onBaseIriChange={changeBaseIri}
            onSelect={selectGraph}
          />
        </Suspense>
      )}
    </div>
  );
}

type GraphPickerProps = {
  graphsPromise: Promise<NamedNode[]>;
  baseIri: string;
  onBaseIriChange: (baseIri: string) => void;
  onSelect: (graph: NamedNode) => void;
};

function GraphPicker({ graphsPromise, baseIri, onBaseIriChange, onSelect }: GraphPickerProps) {
  const graphs = use(graphsPromise);

  return (
    <div className="app-start">
      <h2>Choose the data model to edit</h2>
      {graphs.length === 0 ? (
        <p>There are no Turtle (.ttl) files in this folder yet.</p>
      ) : (
        <ul className="app-graphs">
          {graphs.map((graph) => (
            <li key={graph.value}>
              <button type="button" className="st-button" onClick={() => onSelect(graph)}>
                <span>{graphLabel(graph, baseIri)}</span>
                <code>{graph.value}</code>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="app-new-model"
        onSubmit={(event) => {
          event.preventDefault();
          const name = (new FormData(event.currentTarget).get("name") as string).replace(
            /\.ttl$/,
            "",
          );
          onSelect(DataFactory.namedNode(new URL(name, baseIri).href));
        }}
      >
        <label htmlFor="new-model">New data model</label>
        <p className="app-hint">
          Starts empty. The file is created in this folder when you first save.
        </p>
        <div className="app-base-iri__row">
          <input
            id="new-model"
            name="name"
            className="st-input"
            required
            pattern="[\w.\/\-]+"
            placeholder="model.ttl"
          />
          <button type="submit" className="st-button st-button--primary">
            Create
          </button>
        </div>
      </form>
      <form
        className="app-base-iri"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("baseIri") as string;
          if (value !== baseIri) onBaseIriChange(value);
        }}
      >
        <label htmlFor="base-iri">Base IRI</label>
        <p className="app-hint">
          Each file is a graph named after its path, relative to this IRI. Relative IRIs in the
          files, such as <code>&lt;#Person&gt;</code>, resolve against it too.
        </p>
        <div className="app-base-iri__row">
          <input
            id="base-iri"
            name="baseIri"
            className="st-input"
            type="url"
            required
            pattern=".*/"
            title="Ends with a slash"
            defaultValue={baseIri}
          />
          <button type="submit" className="st-button">
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}

type ManagerProps = { folder: Folder; graph: NamedNode; onSaved: () => void };

function Manager({ folder, graph, onSaved }: ManagerProps) {
  const source = useMemo(() => dataModelSource(folder, graph), [folder, graph]);

  return (
    <ShaclManager
      dataModelIRI={graph}
      loadGraph={source.loadGraph}
      onSubmit={async (changes) => {
        await source.save(changes);
        onSaved();
      }}
    />
  );
}
