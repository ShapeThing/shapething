import type { NamedNode } from "@rdfjs/types";
import { LocalStore } from "@shapething/localstore";
import { ShaclManager } from "@shapething/shacl-manager";
import { Suspense, use, useMemo, useState } from "react";
import {
  configuredBaseIri,
  dataModelSource,
  fileGraph,
  fileLabel,
  listDataModels,
  openFolder,
  type DataModelFile,
  type Folder,
} from "./folder.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { FileBrowser } from "./FileBrowser.tsx";
import { GitPanel } from "./GitPanel.tsx";

// The folder and data model are kept in the query string; the hash belongs to the manager.
const readParam = (name: string) => new URLSearchParams(location.search).get(name) ?? undefined;

// file is the path of the file in the folder, not its graph name, so it follows the base IRI.
function writeParams(params: { folder?: string; file?: string }) {
  const search = new URLSearchParams();
  if (params.folder) search.set("folder", params.folder);
  if (params.file) search.set("file", params.file);
  const query = search.size ? `?${search}` : "";
  history.replaceState(null, "", `${location.pathname}${query}${params.file ? location.hash : ""}`);
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
  // The base IRI from the folder's .config, kept here so the workspace starts over when it changes.
  const [baseIri, setBaseIri] = useState(() => folder && configuredBaseIri(folder));
  const [editingBaseIri, setEditingBaseIri] = useState(false);

  const open = async (name?: string) => {
    setError(undefined);
    const opened = await openFolder(name, { interactive: true }).catch((error: unknown) => {
      setError(String(error));
      return undefined;
    });
    if (!opened) return;
    writeParams({ folder: opened.name });
    setFolder(opened);
    setBaseIri(configuredBaseIri(opened));
    setEditingBaseIri(false);
  };

  const close = () => {
    writeParams({});
    setFolder(undefined);
    setBaseIri(undefined);
    setEditingBaseIri(false);
  };

  if (!folder) return <FolderPicker onOpen={open} error={error} />;

  // Asked for once per folder: after that it is in the folder's .config.
  if (!baseIri || editingBaseIri) {
    return (
      <BaseIriForm
        folder={folder}
        current={baseIri}
        onSaved={(saved) => {
          // The files are other graphs now, a chosen one is chosen again.
          writeParams({ folder: folder.name });
          setBaseIri(saved);
          setEditingBaseIri(false);
        }}
        onCancel={baseIri ? () => setEditingBaseIri(false) : close}
      />
    );
  }

  return (
    <Workspace
      key={`${folder.name} ${baseIri}`}
      folder={folder}
      onClose={close}
      onEditBaseIri={() => setEditingBaseIri(true)}
    />
  );
}

const endsOnSlashOrHash = /[/#]$/;

type BaseIriFormProps = {
  folder: Folder;
  // The base IRI the folder has, when it is changed.
  current?: string;
  onSaved: (baseIri: string) => void;
  onCancel: () => void;
};

function BaseIriForm({ folder, current, onSaved, onCancel }: BaseIriFormProps) {
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const valid = URL.canParse(value) && endsOnSlashOrHash.test(value);

  return (
    <div className="app-start">
      <h1 className="app-start__title">
        <img src="/logo.svg" alt="" className="app-logo" /> {folder.name}
      </h1>
      <form
        className="app-new-model app-base-iri"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(undefined);
          setSaving(true);
          try {
            const baseUri = new URL(value);
            await folder.store.saveBaseUri(baseUri);
            onSaved(baseUri.toString());
          } catch (error) {
            setError(String(error));
          } finally {
            setSaving(false);
          }
        }}
      >
        <h2>{current ? "Change the base IRI" : "Set the base IRI of this folder"}</h2>
        <p className="app-hint">
          The Turtle files in this folder are named by appending their path to the base IRI, and
          relative IRIs in them, such as <code>&lt;#Shape&gt;</code>, resolve against that name. It
          is saved in <code>.config</code> in the folder, so it is only asked once and travels with
          the folder.
        </p>
        <label htmlFor="base-iri">Base IRI</label>
        <input
          id="base-iri"
          className="st-input"
          type="url"
          required
          autoFocus
          pattern=".*[/#]"
          title="An IRI that ends on a / or a #"
          placeholder="https://example.com/def/"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        {valid ? (
          <p className="app-hint">
            <code>model.ttl</code> is <code>&lt;{new URL(value).toString()}model&gt;</code>
          </p>
        ) : (
          value && <p className="app-hint">The base IRI ends on a / or a #.</p>
        )}
        {current && (
          <p className="app-hint">
            The files are not changed, their relative IRIs resolve against the new base IRI.
          </p>
        )}
        <div className="app-base-iri__actions">
          <button type="submit" className="st-button st-button--primary" disabled={saving}>
            Save
          </button>
          <button type="button" className="st-button" onClick={onCancel}>
            {current ? "Cancel" : "Choose another folder"}
          </button>
        </div>
        {error && <p className="app-error">{error}</p>}
      </form>
    </div>
  );
}

const mountsPromise = supported ? LocalStore.listMounts().catch(() => []) : Promise.resolve([]);

function FolderPicker({ onOpen, error }: { onOpen: (name?: string) => void; error?: string }) {
  const [mounts, setMounts] = useState(use(mountsPromise));
  const [last, setLast] = useState(() => readParam("folder"));
  const [removeError, setRemoveError] = useState<string>();

  // Only the connection is forgotten, the folder on disk stays as it is.
  const remove = async (name: string) => {
    setRemoveError(undefined);
    try {
      await LocalStore.removeMount(name);
      setMounts((mounts) => mounts.filter((mount) => mount !== name));
      if (name === last) {
        writeParams({});
        setLast(undefined);
      }
    } catch (error) {
      setRemoveError(String(error));
    }
  };

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
                  <li key={name} className="app-start__recent-item">
                    <button type="button" className="st-button" onClick={() => onOpen(name)}>
                      {name}
                      {name === last && " (last opened)"}
                    </button>
                    <button
                      type="button"
                      className="st-button app-start__remove"
                      title={`Remove ${name} from the recent folders, the folder itself is kept`}
                      aria-label={`Remove ${name} from the recent folders`}
                      onClick={() => remove(name)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {error && <p className="app-error">{error}</p>}
      {removeError && <p className="app-error">{removeError}</p>}
    </div>
  );
}

// The chosen file, by its graph name in the folder.
type Selection = { file: NamedNode };

type WorkspaceProps = { folder: Folder; onClose: () => void; onEditBaseIri: () => void };

function Workspace({ folder, onClose, onEditBaseIri }: WorkspaceProps) {
  const [modelsPromise, setModelsPromise] = useState(() => listDataModels(folder));
  const [selection, setSelection] = useState<Selection | undefined>(() => {
    const path = readParam("file");
    return path ? { file: fileGraph(folder, path) } : undefined;
  });
  // Bumped on every save, so the git panel looks at the files again.
  const [saves, setSaves] = useState(0);

  const select = (next?: Selection) => {
    writeParams({
      folder: folder.name,
      file: next && fileLabel(next.file, folder),
    });
    // Back at the list: files may have been added or declare another IRI by now.
    if (!next) setModelsPromise(listDataModels(folder));
    setSelection(next);
  };

  return (
    <div className="app">
      <header className="app-bar">
        <span className="app-brand" onClick={onClose}>
          <img src="/logo.svg" alt="" className="app-logo" />
          SHACL manager
        </span>
        <FilePath
          folder={folder}
          file={selection && fileLabel(selection.file, folder)}
          onFolder={() => select()}
          onSettings={onEditBaseIri}
        />
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
                Could not open {fileLabel(selection.file, folder)}: {String(error)}
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

// Where you are, as a path: the folder's base IRI, then the file in it. The base IRI leads back to
// the files, the cog behind it to the folder's settings.
function FilePath({
  folder,
  file,
  onFolder,
  onSettings,
}: {
  folder: Folder;
  file?: string;
  onFolder: () => void;
  onSettings: () => void;
}) {
  // A file outside the base IRI is labeled by its full IRI, which is not split up.
  const segments = !file ? [] : file.includes("://") ? [file] : file.split("/");
  // Its trailing slash is the path's first separator.
  const base = folder.store.getBaseUri().toString().replace(/\/$/, "");

  return (
    <nav className="app-path" aria-label="Location">
      <ol>
        <li>
          {file ? (
            <button
              type="button"
              className="app-path__segment"
              title={`${folder.name}, choose another data model`}
              onClick={onFolder}
            >
              {base}
            </button>
          ) : (
            <span className="app-path__segment" title={folder.name} aria-current="page">
              {base}
            </span>
          )}
          <button
            type="button"
            className="app-path__settings"
            title="Change the base IRI"
            aria-label="Folder settings"
            onClick={onSettings}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
              <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
            </svg>
          </button>
        </li>
        {segments.map((segment, index) => (
          <li key={index}>
            <span
              className="app-path__segment"
              aria-current={index === segments.length - 1 ? "page" : undefined}
            >
              {segment}
            </span>
          </li>
        ))}
      </ol>
    </nav>
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
    <div className="app-start app-start--wide">
      <h2>Choose the data model to edit</h2>
      {models.length === 0 ? (
        <p>There are no Turtle (.ttl) files in this folder yet.</p>
      ) : (
        <FileBrowser folder={folder} models={models} onOpen={(file) => onSelect({ file })} />
      )}
      <details className="app-new-model-toggle" open={models.length === 0}>
        <summary>New data model…</summary>
        <form
          className="app-new-model"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onSelect({ file: fileGraph(folder, data.get("name") as string) });
          }}
        >
          <p className="app-hint">
            Starts empty. The file is created in this folder when you first save. Its IRI is the
            base IRI followed by its path: <code>model.ttl</code> is{" "}
            <code>&lt;{fileGraph(folder, "model.ttl").value}&gt;</code>.
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
          <button type="submit" className="st-button st-button--primary">
            Create
          </button>
        </form>
      </details>
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
  // An existing file decides its own IRI; a new one is named after its file.
  const model = useMemo(
    () =>
      models.find(({ file }) => file.equals(selection.file)) ?? {
        file: selection.file,
        iri: selection.file,
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
