import type { NamedNode, Quad } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import {
  readCachedImport,
  writeCachedImport,
  writeUnresolvableImport,
  type CachedImport,
} from "./importCache.ts";

// How the manager gets its RDF is up to the host: a file on disk, a triple store, a fetch through
// a proxy... The manager only asks for a graph by IRI and receives its quads, plus the prefixes
// the source declared (Turtle's @prefix and the like) when the format has them.
export type LoadedGraph = { quads: Quad[]; prefixes: Record<string, string> };
export type LoadGraph = (graph: NamedNode) => Promise<LoadedGraph>;

export type DataModel = {
  dataModelIRI: NamedNode;
  // The data model's own graph plus everything it (transitively) owl:imports.
  store: RdfStore;
  // Every prefix declared by the data model and its imports, alias -> namespace IRI. On a clash
  // the data model's own declaration wins; between imports, the first one loaded.
  prefixes: Record<string, string>;
  importedGraphIRIs: NamedNode[];
  // The subset of importedGraphIRIs that came from the browser cache rather than loadGraph.
  cachedGraphIRIs: NamedNode[];
  // Imports that could not be loaded (now, or remembered from an earlier load); not in the store.
  unresolvableGraphIRIs: NamedNode[];
};

const factory = new DataFactory();
const owlImports = factory.namedNode("http://www.w3.org/2002/07/owl#imports");

// Cache first, loadGraph second. A failed cache read (private window, blocked storage) just falls
// through to loadGraph, and a failed cache write only costs speed next time - neither may break
// the load itself. A loadGraph failure is remembered too, so a dead import (moved document,
// expired domain) isn't fetched again on every load; it's someone else's problem, not this data
// model's, so it never fails the load.
async function loadImport(
  graph: NamedNode,
  loadGraph: LoadGraph,
): Promise<CachedImport & { fromCache: boolean }> {
  const cached = await readCachedImport(graph).catch((error) => {
    console.warn(`[shacl-manager] Could not read <${graph.value}> from the import cache:`, error);
    return undefined;
  });
  if (cached) return { ...cached, fromCache: true };

  const warnCacheWrite = (error: unknown) =>
    console.warn(`[shacl-manager] Could not cache <${graph.value}>:`, error);

  try {
    const loaded = await loadGraph(graph);
    writeCachedImport(graph, loaded).catch(warnCacheWrite);
    return { status: "resolved", ...loaded, fromCache: false };
  } catch (error) {
    console.warn(`[shacl-manager] Failed to resolve owl:imports <${graph.value}>:`, error);
    writeUnresolvableImport(graph, error).catch(warnCacheWrite);
    return { status: "unresolvable", error: String(error), fromCache: false };
  }
}

// Loads the data model's own graph (always fresh - it's what gets edited), then follows every
// owl:imports statement in the store until a pass turns up no new graph IRIs: an imported graph
// can declare imports of its own (see examples/nl-sbb-begrippenkader's skosapnl.ttl). `visited`
// makes an import cycle terminate.
export async function loadDataModel(
  dataModelIRI: NamedNode,
  loadGraph: LoadGraph,
): Promise<DataModel> {
  const store = RdfStore.createDefault();
  const own = await loadGraph(dataModelIRI);
  for (const quad of own.quads) store.addQuad(quad);
  const importedPrefixes: Record<string, string> = {};

  const visited = new Set([dataModelIRI.value]);
  const importedGraphIRIs: NamedNode[] = [];
  const cachedGraphIRIs: NamedNode[] = [];
  const unresolvableGraphIRIs: NamedNode[] = [];

  while (true) {
    const pending = new Map<string, NamedNode>();
    for (const { object } of store.getQuads(null, owlImports)) {
      if (object.termType === "NamedNode" && !visited.has(object.value)) {
        pending.set(object.value, object);
      }
    }
    if (pending.size === 0) break;

    const graphs = [...pending.values()];
    for (const graph of graphs) visited.add(graph.value);

    const results = await Promise.all(graphs.map((graph) => loadImport(graph, loadGraph)));
    for (const [index, result] of results.entries()) {
      const graph = graphs[index];
      if (result.status === "unresolvable") {
        unresolvableGraphIRIs.push(graph);
        continue;
      }
      for (const quad of result.quads) store.addQuad(quad);
      for (const [alias, namespace] of Object.entries(result.prefixes)) {
        importedPrefixes[alias] ??= namespace;
      }
      importedGraphIRIs.push(graph);
      if (result.fromCache) cachedGraphIRIs.push(graph);
    }
  }

  return {
    dataModelIRI,
    store,
    prefixes: { ...importedPrefixes, ...own.prefixes },
    importedGraphIRIs,
    cachedGraphIRIs,
    unresolvableGraphIRIs,
  };
}
