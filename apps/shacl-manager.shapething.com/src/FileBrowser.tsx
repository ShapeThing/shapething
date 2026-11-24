import type { NamedNode } from "@rdfjs/types";
import type { CSSProperties } from "react";
import { fileLabel, type DataModelFile, type Folder } from "./folder.ts";

// A folder in the browser: its subfolders and the data model files directly in it.
type Directory = {
  name: string;
  path: string;
  directories: Map<string, Directory>;
  files: { name: string; model: DataModelFile }[];
};

// The files are named by their path in the folder, a/b/model.ttl; the tree is rebuilt from those.
function buildTree(models: DataModelFile[], folder: Folder): Directory {
  const root: Directory = { name: folder.name, path: "", directories: new Map(), files: [] };
  for (const model of models) {
    const segments = fileLabel(model.file, folder).split("/");
    const name = segments.pop()!;
    let directory = root;
    for (const segment of segments) {
      let next = directory.directories.get(segment);
      if (!next) {
        const path = directory.path ? `${directory.path}/${segment}` : segment;
        next = { name: segment, path, directories: new Map(), files: [] };
        directory.directories.set(segment, next);
      }
      directory = next;
    }
    directory.files.push({ name, model });
  }
  return root;
}

const count = (directory: Directory): number =>
  directory.files.length +
  [...directory.directories.values()].reduce((sum, child) => sum + count(child), 0);

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

type FileBrowserProps = {
  folder: Folder;
  models: DataModelFile[];
  onOpen: (file: NamedNode) => void;
};

export function FileBrowser({ folder, models, onOpen }: FileBrowserProps) {
  const root = buildTree(models, folder);

  return (
    <div className="file-browser" role="tree" aria-label={`Data models in ${folder.name}`}>
      <div className="file-browser__head" aria-hidden="true">
        <span>Name</span>
        <span>Data model</span>
      </div>
      <DirectoryContents directory={root} depth={0} onOpen={onOpen} />
    </div>
  );
}

type DirectoryContentsProps = {
  directory: Directory;
  depth: number;
  onOpen: (file: NamedNode) => void;
};

function DirectoryContents({ directory, depth, onOpen }: DirectoryContentsProps) {
  const indent = { "--depth": depth } as CSSProperties;

  return (
    <>
      {[...directory.directories.values()].sort(byName).map((child) => (
        <details key={child.path} className="file-browser__dir" open role="treeitem">
          <summary className="file-browser__row" style={indent}>
            <span className="file-browser__name">
              <Chevron />
              <FolderIcon />
              {child.name}
            </span>
            <span className="file-browser__meta">
              {count(child)} {count(child) === 1 ? "file" : "files"}
            </span>
          </summary>
          <div role="group">
            <DirectoryContents directory={child} depth={depth + 1} onOpen={onOpen} />
          </div>
        </details>
      ))}
      {directory.files.sort(byName).map(({ name, model }) => (
        <button
          key={model.file.value}
          type="button"
          role="treeitem"
          className="file-browser__row file-browser__file"
          style={indent}
          onClick={() => onOpen(model.file)}
        >
          <span className="file-browser__name">
            <span className="file-browser__spacer" />
            <FileIcon />
            {name}
          </span>
          <span className="file-browser__model">
            {model.title && <span className="file-browser__title">{model.title}</span>}
            {!model.iri.equals(model.file) && (
              <span className="file-browser__iri" title={model.iri.value}>
                {model.iri.value}
              </span>
            )}
          </span>
        </button>
      ))}
    </>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const Chevron = () => (
  <svg {...iconProps} className="file-browser__chevron">
    <path d="M6 4l4 4-4 4" strokeLinecap="round" />
  </svg>
);

const FolderIcon = () => (
  <svg {...iconProps} className="file-browser__icon file-browser__icon--folder">
    <path d="M1.5 3.5h4.5l1.5 1.5h7v8.5h-13z" />
  </svg>
);

const FileIcon = () => (
  <svg {...iconProps} className="file-browser__icon">
    <path d="M3.5 1.5h6l3 3v10h-9z" />
    <path d="M9.5 1.5v3h3" />
  </svg>
);
