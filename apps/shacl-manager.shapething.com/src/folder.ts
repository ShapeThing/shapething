import type { NamedNode, Quad } from "@rdfjs/types";
import { LocalStore } from "@shapething/localstore";
import type { LoadGraph } from "@shapething/shacl-manager";
import { type BCP47, dereferenceUrl, owl, rdf, sh, termLabel } from "@shapething/shacl-renderer";
import { DataFactory, Store } from "n3";
import { RdfStore } from "rdf-stores";
import { CORS_PROXY_URL } from "./corsProxy.ts";
import { Repository } from "./git/repository.ts";

export type Folder = {
  name: string;
  store: LocalStore;
  // Only when the folder is a git repository.
  repository?: Repository;
};

// The files of a folder are graphs named after their path, appended to the folder's base IRI:
// model.ttl is <{base}model>. The base IRI is kept in the folder's .config; until one is set the
// graphs are named <file:///{folder}/model>, a name that only finds the file again. The data
// model's IRI comes from what the file declares.
export const folderBase = (folder: string) => `file:///${encodeURIComponent(folder)}/`;

// Mounts a folder that was connected before (by name) or asks for a new one. Reading and writing
// a folder needs permission, given again on every visit unless the browser remembers it: with
// `interactive` it is asked for, which only works right after a click.
export async function openFolder(
  name: string | undefined,
  { interactive }: { interactive: boolean },
): Promise<Folder | undefined> {
  const store = new LocalStore({ baseUri: new URL("file:///") });
  await store.mount(name);
  const handle = store.getDirectoryHandle();
  if (!handle) return undefined;

  const mode = { mode: "readwrite" } as const;
  const permission = interactive
    ? await handle.requestPermission(mode)
    : await handle.queryPermission(mode);
  if (permission !== "granted") return undefined;

  store.setBaseUri(new URL(folderBase(handle.name)));
  // The .config could not be read while mounting when permission was only given just now.
  await store.loadConfig();
  return { name: handle.name, store, repository: await Repository.open(handle) };
}

// A file in the folder and the data model it holds: the subject it declares an owl:Ontology or
// sh:ShapesGraph, or the file's own graph name when it declares none. The title is the data
// model's label as the renderer resolves it, the same as the manager shows it.
export type DataModelFile = { file: NamedNode; iri: NamedNode; title?: string };

async function titleOf(store: LocalStore, file: NamedNode, iri: NamedNode) {
  // Without a declared IRI the label would only be the file name again.
  if (iri.equals(file)) return undefined;
  const graph = RdfStore.createDefault();
  for (const quad of await readGraph(store, file)) graph.addQuad(quad);
  return termLabel({
    term: iri,
    shapesGraph: graph,
    languages: [...navigator.languages] as BCP47[],
  });
}

async function declaredIri(store: LocalStore, file: NamedNode): Promise<NamedNode | undefined> {
  const subjects = new Map<string, NamedNode>();
  for await (const quad of store.match(
    null,
    rdf("type"),
    null,
    file,
  ) as unknown as AsyncIterable<Quad>) {
    if (quad.subject.termType !== "NamedNode") continue;
    if (quad.object.equals(owl("Ontology"))) return quad.subject;
    if (quad.object.equals(sh("ShapesGraph"))) subjects.set(quad.subject.value, quad.subject);
  }
  return subjects.values().next().value;
}

export async function listDataModels({ store }: Folder): Promise<DataModelFile[]> {
  const files: NamedNode[] = [];
  for await (const graph of store.getNamedGraphs()) {
    if (graph.termType === "NamedNode") files.push(graph);
  }
  const models = await Promise.all(
    files.map(async (file) => {
      // A file that can't be parsed is still listed, opening it shows the error.
      const iri = (await declaredIri(store, file).catch(() => undefined)) ?? file;
      const title = await titleOf(store, file, iri).catch(() => undefined);
      return { file, iri, title };
    }),
  );
  return models.sort((a, b) => a.file.value.localeCompare(b.file.value));
}

// The base IRI the folder sets in its .config, undefined until it is given one.
export const configuredBaseIri = ({ store }: Folder) => store.getConfiguredBaseUri()?.toString();

// The graph of a file in the folder, by its path: model.ttl is <{base}model>.
export const fileGraph = ({ store }: Folder, path: string) =>
  DataFactory.namedNode(store.getBaseUri().toString() + encodeURI(path.replace(/\.ttl$/, "")));

// What the user recognizes a file by: its path in the folder.
export const fileLabel = (file: NamedNode, { store }: Folder) => {
  const base = store.getBaseUri().toString();
  return file.value.startsWith(base)
    ? `${decodeURI(file.value.slice(base.length))}.ttl`
    : file.value;
};

async function hasGraph(store: LocalStore, graph: NamedNode) {
  for await (const _ of store.getNamedGraphs([graph])) return true;
  return false;
}

async function readGraph(store: LocalStore, graph: NamedNode): Promise<Quad[]> {
  const quads: Quad[] = [];
  // The stream is async iterable, the RDF/JS Stream type just does not say so.
  for await (const quad of store.match(null, null, null, graph) as unknown as AsyncIterable<Quad>) {
    quads.push(quad);
  }
  return quads;
}

export type DataModelSource = {
  loadGraph: LoadGraph;
  // Writes the data model's own graph back to its file.
  save: (changes: { additions: Quad[]; deletions: Quad[] }) => Promise<void>;
};

// The data model and any import that is a file in the folder come from disk, other imports from
// the web. An import names a data model by its IRI, so the folder's files are looked up by the IRI
// they declare. What was loaded of the data model is kept, so a save can write the whole graph:
// blank nodes can't be matched for deletion between two parses of the file.
export function dataModelSource(
  folder: Folder,
  model: DataModelFile,
  // The other data models in the folder, for imports.
  others: DataModelFile[],
): DataModelSource {
  const own = new Store();

  const fileOf = async (graph: NamedNode) => {
    if (graph.equals(model.iri)) return model.file;
    const other = others.find(({ iri }) => iri.equals(graph));
    if (other) return other.file;
    if (await hasGraph(folder.store, graph)) return graph;
  };

  const loadGraph: LoadGraph = async (graph) => {
    const file = await fileOf(graph);
    if (file && (await hasGraph(folder.store, file))) {
      const quads = (await readGraph(folder.store, file)).map((quad) =>
        DataFactory.quad(quad.subject, quad.predicate, quad.object, graph),
      );
      if (graph.equals(model.iri)) {
        own.removeQuads(own.getQuads(null, null, null, null));
        own.addQuads(quads);
      }
      return { quads, prefixes: { ...folder.store.prefixes } };
    }

    // A new data model: its file is written on the first save.
    if (graph.equals(model.iri)) return { quads: [], prefixes: {} };

    const prefixes = new Map<string, string>();
    const fetched = await dereferenceUrl(new URL(graph.value), new Map(), CORS_PROXY_URL, prefixes);
    return {
      quads: fetched
        .getQuads()
        .map((quad) => DataFactory.quad(quad.subject, quad.predicate, quad.object, graph)),
      prefixes: Object.fromEntries(prefixes),
    };
  };

  const save: DataModelSource["save"] = async ({ additions, deletions }) => {
    for (const quad of deletions) own.removeQuad(quad);
    own.addQuads(additions);
    await folder.store.replaceGraph(model.file, own.getQuads(null, null, null, null));
  };

  return { loadGraph, save };
}
