import type { NamedNode, Quad } from "@rdfjs/types";
import { owl } from "@shapething/shacl-renderer";
import { RdfStore } from "rdf-stores";
import { replaceStore } from "./storeCache.ts";
import {
  readCachedImport,
  writeCachedImport,
  writeUnresolvableImport,
  type CachedImport,
} from "./importCache.ts";

// The host loads a graph by IRI: its quads, tagged with that IRI as their graph, and the prefixes
// the source declared.
export type LoadedGraph = { quads: Quad[]; prefixes: Record<string, string> };
export type LoadGraph = (graph: NamedNode) => Promise<LoadedGraph>;

export type DataModel = {
  dataModelIRI: NamedNode;
  // The data model's own graph plus everything it transitively owl:imports.
  store: RdfStore;
  // On a clash the data model's own declaration wins; between imports, the first one loaded.
  prefixes: Record<string, string>;
  // The prefixes the data model's own source declared.
  ownPrefixes: Record<string, string>;
  importedGraphIRIs: NamedNode[];
  // The imports read from the browser cache rather than loadGraph.
  cachedGraphIRIs: NamedNode[];
  // Imports that could not be loaded, now or remembered from an earlier load.
  unresolvableGraphIRIs: NamedNode[];
};

// Cache first, loadGraph second. Cache failures (private window, blocked storage) never break the
// load, and neither does a dead import.
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

// The data model's own graph is always loaded fresh. Imports are followed transitively.
export async function loadDataModel(
  dataModelIRI: NamedNode,
  loadGraph: LoadGraph,
): Promise<DataModel> {
  const own = await loadGraph(dataModelIRI);
  return resolveImports(dataModelIRI, own.quads, own.prefixes, loadGraph);
}

// The own graph's owl:imports, the ones that decide what else is loaded.
export const ownImports = ({ store, dataModelIRI }: DataModel): string[] =>
  store
    .getQuads(null, owl("imports"), null, dataModelIRI)
    .flatMap(({ object }) => (object.termType === "NamedNode" ? [object.value] : []))
    .sort();

// After an edit that changed the own owl:imports: the same own graph, with the imports it now
// asks for. Imports that were loaded before mostly come from the cache.
export async function reloadImports(
  dataModel: DataModel,
  loadGraph: LoadGraph,
): Promise<DataModel> {
  const { dataModelIRI, store, ownPrefixes } = dataModel;
  const ownQuads = store.getQuads(null, null, null, dataModelIRI);
  const next = await resolveImports(dataModelIRI, ownQuads, ownPrefixes, loadGraph);
  replaceStore(store, next.store);
  return next;
}

async function resolveImports(
  dataModelIRI: NamedNode,
  ownQuads: Quad[],
  ownPrefixes: Record<string, string>,
  loadGraph: LoadGraph,
): Promise<DataModel> {
  const store = RdfStore.createDefault();
  for (const quad of ownQuads) store.addQuad(quad);
  const importedPrefixes: Record<string, string> = {};

  const visited = new Set([dataModelIRI.value]);
  const importedGraphIRIs: NamedNode[] = [];
  const cachedGraphIRIs: NamedNode[] = [];
  const unresolvableGraphIRIs: NamedNode[] = [];

  while (true) {
    const pending = new Map<string, NamedNode>();
    for (const { object } of store.getQuads(null, owl("imports"))) {
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
    prefixes: { ...importedPrefixes, ...ownPrefixes },
    ownPrefixes,
    importedGraphIRIs,
    cachedGraphIRIs,
    unresolvableGraphIRIs,
  };
}
