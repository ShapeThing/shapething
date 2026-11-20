import type { NamedNode, Quad } from "@rdfjs/types";
import { LocalStore } from "@shapething/localstore";
import type { LoadGraph } from "@shapething/shacl-manager";
import { dereferenceUrl } from "@shapething/shacl-renderer";
import { DataFactory, Store } from "n3";
import { CORS_PROXY_URL } from "./corsProxy.ts";
import { Repository } from "./git/repository.ts";

export type Folder = {
  name: string;
  store: LocalStore;
  // Only when the folder is a git repository.
  repository?: Repository;
};

// The files of a folder are graphs named relative to its base IRI: model.ttl is <{base}model>.
// Without one chosen, the folder itself is the base.
const baseIriKey = (folder: string) => `shacl-manager:base-iri:${folder}`;

export function baseIriOf(folder: string): string {
  try {
    const stored = localStorage.getItem(baseIriKey(folder));
    if (stored) return stored;
  } catch {}
  return `file:///${encodeURIComponent(folder)}/`;
}

export function setBaseIri(folder: Folder, baseIri: string) {
  folder.store.setBaseUri(new URL(baseIri));
  try {
    localStorage.setItem(baseIriKey(folder.name), baseIri);
  } catch {}
}

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

  store.setBaseUri(new URL(baseIriOf(handle.name)));
  return { name: handle.name, store, repository: await Repository.open(handle) };
}

export async function listGraphs({ store }: Folder): Promise<NamedNode[]> {
  const graphs: NamedNode[] = [];
  for await (const graph of store.getNamedGraphs()) {
    if (graph.termType === "NamedNode") graphs.push(graph);
  }
  return graphs.sort((a, b) => a.value.localeCompare(b.value));
}

// What the user recognizes a graph by: its path in the folder, or its IRI when it lives elsewhere.
export const graphLabel = (graph: NamedNode, baseIri: string) =>
  graph.value.startsWith(baseIri) ? `${graph.value.slice(baseIri.length)}.ttl` : graph.value;

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
// the web. What was loaded of the data model is kept, so a save can write the whole graph: blank
// nodes can't be matched for deletion between two parses of the file.
export function dataModelSource(folder: Folder, dataModelIRI: NamedNode): DataModelSource {
  const own = new Store();

  const loadGraph: LoadGraph = async (graph) => {
    if (await hasGraph(folder.store, graph)) {
      const quads = await readGraph(folder.store, graph);
      if (graph.equals(dataModelIRI)) {
        own.removeQuads(own.getQuads(null, null, null, null));
        own.addQuads(quads);
      }
      return { quads, prefixes: { ...folder.store.prefixes } };
    }

    // A new data model: its file is written on the first save.
    if (graph.equals(dataModelIRI)) return { quads: [], prefixes: {} };

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
    await folder.store.replaceGraph(dataModelIRI, own.getQuads(null, null, null, null));
  };

  return { loadGraph, save };
}
