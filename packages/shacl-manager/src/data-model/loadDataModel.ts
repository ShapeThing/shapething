import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { select } from "@/data-model/select.ts";
import { factory } from "@/helpers/factory.ts";
import owlImportsQuery from "@/data-model/owlImports.rq";

export type LoadGraph = (graph: NamedNode) => Promise<Quad[]>;

export type DataModel = {
  dataModelIRI: NamedNode;
  store: RdfStore;
  importedGraphIRIs: NamedNode[];
  // Every quad that came in through owl:imports rather than from the data model's own graph.
  // Handed to ShaclRenderer as its readOnlyGraph, so imported values render but can't be edited.
  readOnlyGraph: RdfStore;
  // False for a subject that is only described by imported graphs - someone else's standard.
  isEditable: (term: Term) => boolean;
  // True for a subject the data model's own graph says something about (the "hide imports" filter).
  isLocal: (term: Term) => boolean;
  // Writes a form's submit diff into the main graph. Changes only live in memory for now.
  applyChanges: (changes: { additions: Quad[]; deletions: Quad[] }) => void;
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
  const owlImportEntries = await select(owlImportsQuery, store);
  const imports = new Map<string, NamedNode>();
  for (const { importedGraph } of owlImportEntries) {
    if (importedGraph.termType === "NamedNode" && !visited.has(importedGraph.value)) {
      imports.set(importedGraph.value, importedGraph);
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
  // loadGraph decides which named graph its quads land in (see the stories' loadGraph), so the
  // main graph is whatever graph(s) the data model's own quads were tagged with.
  const mainGraphs = new Set<string>();
  for (const quad of await loadGraph(dataModelIRI)) {
    store.addQuad(quad);
    mainGraphs.add(quad.graph.value);
  }

  const importedGraphIRIs = await resolveOwlImports(
    store,
    loadGraph,
    new Set([dataModelIRI.value]),
  );

  const readOnlyGraph = RdfStore.createDefault();
  for (const quad of store.getQuads()) {
    if (!mainGraphs.has(quad.graph.value)) readOnlyGraph.addQuad(quad);
  }

  const isLocal = (term: Term) =>
    store.getQuads(term).some((quad) => mainGraphs.has(quad.graph.value));

  // A subject nobody describes yet is new, and new things are always created in the main graph.
  const isEditable = (term: Term) => store.getQuads(term).length === 0 || isLocal(term);

  const mainGraph = [...mainGraphs][0] ?? dataModelIRI.value;

  // The renderer reports quads without caring which graph they live in, so a deletion removes the
  // triple from every main graph (imports are never touched) and an addition lands in the first.
  const applyChanges = ({ additions, deletions }: { additions: Quad[]; deletions: Quad[] }) => {
    for (const { subject, predicate, object } of deletions) {
      for (const quad of store.getQuads(subject, predicate, object)) {
        if (mainGraphs.has(quad.graph.value) || quad.graph.termType === "DefaultGraph") {
          store.removeQuad(quad);
        }
      }
    }
    for (const { subject, predicate, object } of additions) {
      store.addQuad(factory.quad(subject, predicate, object, factory.namedNode(mainGraph)));
    }
  };

  return {
    dataModelIRI,
    store,
    importedGraphIRIs,
    readOnlyGraph,
    isEditable,
    isLocal,
    applyChanges,
  };
}
