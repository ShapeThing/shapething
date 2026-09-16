import type { NamedNode, Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { owl } from "@/helpers/namespaces.ts";

export type LoadGraph = (graph: NamedNode) => Promise<Quad[]>;

export type DataModel = {
  dataModelIRI: NamedNode;
  store: RdfStore;
  importedGraphIRIs: NamedNode[];
};

// owl:imports is resolved transitively - an imported graph can itself declare further imports
// (see e.g. examples/nl-sbb-begrippenkader's skosapnl.ttl) - so the store is rescanned after
// every merge until a pass turns up nothing new. `visited` is scoped to one loadDataModel() call
// so an import cycle terminates instead of looping forever.
async function resolveOwlImports(
  store: RdfStore,
  loadGraph: LoadGraph,
  visited: Set<string>,
): Promise<NamedNode[]> {
  const imports = new Map<string, NamedNode>();
  for (const quad of store.getQuads(null, owl("imports"), null, null)) {
    if (quad.object.termType === "NamedNode" && !visited.has(quad.object.value)) {
      imports.set(quad.object.value, quad.object);
    }
  }
  if (imports.size === 0) return [];

  const graphs = [...imports.values()];
  for (const graph of graphs) visited.add(graph.value);

  // A dead/unreachable import (moved doc, expired domain) must not fail the whole data model -
  // it's someone else's standard, not this data model's own content - so each import is resolved
  // independently and a failure is only logged, not thrown.
  const results = await Promise.allSettled(graphs.map((graph) => loadGraph(graph)));
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.warn(
        `[shacl-manager] Failed to resolve owl:imports <${graphs[index].value}>:`,
        result.reason,
      );
      continue;
    }
    for (const quad of result.value) store.addQuad(quad);
  }

  return [...graphs, ...(await resolveOwlImports(store, loadGraph, visited))];
}

// Loads dataModelIRI into a fresh store, then follows every owl:imports statement found until no
// new graph IRIs turn up, so a data model's shapes/data spread across nested imports are all
// queryable from one store.
export async function loadDataModel(
  dataModelIRI: NamedNode,
  loadGraph: LoadGraph,
): Promise<DataModel> {
  const store = RdfStore.createDefault();
  for (const quad of await loadGraph(dataModelIRI)) store.addQuad(quad);

  const importedGraphIRIs = await resolveOwlImports(
    store,
    loadGraph,
    new Set([dataModelIRI.value]),
  );

  return { dataModelIRI, store, importedGraphIRIs };
}
