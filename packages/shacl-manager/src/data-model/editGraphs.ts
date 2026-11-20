import type { NamedNode, Quad } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import type { DataModel } from "./loadDataModel.ts";
import { factory } from "./rdf.ts";

const inGraph = (quad: Quad, graph: NamedNode): Quad =>
  factory.quad(quad.subject, quad.predicate, quad.object, graph);

// The data graph an edit form starts from: the data model, plus a new node's starting quads.
export function editDataGraph({ store, dataModelIRI }: DataModel, extra: Quad[] = []): RdfStore {
  if (extra.length === 0) return store;
  const dataGraph = RdfStore.createDefault();
  for (const quad of store.getQuads()) dataGraph.addQuad(quad);
  for (const quad of extra) dataGraph.addQuad(inGraph(quad, dataModelIRI));
  return dataGraph;
}

// Only the data model's own graph is edited; the imports are read-only in the form.
export function importedQuads({ store, dataModelIRI }: DataModel): RdfStore {
  const readOnly = RdfStore.createDefault();
  for (const quad of store.getQuads()) {
    if (!quad.graph.equals(dataModelIRI)) readOnly.addQuad(quad);
  }
  return readOnly;
}

// The data model after an edit form was submitted with `submitted` (SubmitResult.dataGraph). Its
// own graph becomes what was submitted, including the quads the renderer wrote in the default
// graph. A new store, so every query cached for the old one runs again.
export function commitEdit(dataModel: DataModel, submitted: RdfStore): DataModel {
  const { store, dataModelIRI } = dataModel;
  const next = RdfStore.createDefault();
  for (const quad of store.getQuads()) {
    if (!quad.graph.equals(dataModelIRI)) next.addQuad(quad);
  }
  for (const quad of submitted.getQuads()) {
    if (quad.graph.equals(dataModelIRI) || quad.graph.termType === "DefaultGraph") {
      next.addQuad(inGraph(quad, dataModelIRI));
    }
  }
  return { ...dataModel, store: next };
}

export function ownQuads({ store, dataModelIRI }: DataModel): Quad[] {
  return store.getQuads(null, null, null, dataModelIRI);
}

// A new node's IRI in the data model's namespace. The form lets the user pick a better one.
export function mintIri({ dataModelIRI }: DataModel, kind: string): NamedNode {
  const base = /[#/]$/.test(dataModelIRI.value) ? dataModelIRI.value : `${dataModelIRI.value}#`;
  return factory.namedNode(`${base}${kind}-${crypto.randomUUID().slice(0, 8)}`);
}
