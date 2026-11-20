import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { rdf, sh, xsd } from "@shapething/shacl-renderer";
import { RdfStore } from "rdf-stores";
import type { DataModel } from "./loadDataModel.ts";
import { factory, termKey, type Resource } from "./rdf.ts";
import { replaceStore } from "./storeCache.ts";

const has = (store: RdfStore, quad: Quad) =>
  store.getQuads(quad.subject, quad.predicate, quad.object, quad.graph).length > 0;

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
// graph. A new store, so every query cached for the old one runs again - unless nothing changed.
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
  const unchanged =
    next.size === store.size && ownQuads(dataModel).every((quad) => has(next, quad));
  if (unchanged) return dataModel;
  replaceStore(store, next);
  return { ...dataModel, store: next };
}

export function ownQuads({ store, dataModelIRI }: DataModel): Quad[] {
  return store.getQuads(null, null, null, dataModelIRI);
}

// What changed in the data model's own graph.
export type Changes = { additions: Quad[]; deletions: Quad[] };

// A snapshot of the data model's own graph, to compare a later data model with.
export function ownGraph(dataModel: DataModel): RdfStore {
  const graph = RdfStore.createDefault();
  for (const quad of ownQuads(dataModel)) graph.addQuad(quad);
  return graph;
}

// The snapshot with the changes applied.
export function withChanges(saved: RdfStore, { additions, deletions }: Changes): RdfStore {
  const next = RdfStore.createDefault();
  for (const quad of saved.getQuads()) next.addQuad(quad);
  for (const quad of deletions) next.removeQuad(quad);
  for (const quad of additions) next.addQuad(quad);
  return next;
}

export function changesSince(saved: RdfStore, dataModel: DataModel): Changes {
  return {
    additions: ownQuads(dataModel).filter((quad) => !has(saved, quad)),
    deletions: saved.getQuads().filter((quad) => !has(dataModel.store, quad)),
  };
}

// A new node's IRI in the data model's namespace. The form lets the user pick a better one.
export function mintIri({ dataModelIRI }: DataModel, kind: string): NamedNode {
  const base = /[#/]$/.test(dataModelIRI.value) ? dataModelIRI.value : `${dataModelIRI.value}#`;
  return factory.namedNode(`${base}${kind}-${crypto.randomUUID().slice(0, 8)}`);
}

const deactivated = sh("deactivated");
const isTrue = (term: Term) =>
  term.termType === "Literal" && (term.value === "true" || term.value === "1");

// Whether a shape, constraint or rule is sh:deactivated. The data model's own graph overrides the
// imports, so a model can switch off, or back on, what it imports.
export function isDeactivated({ store, dataModelIRI }: DataModel, term: Resource): boolean {
  const own = store.getQuads(term, deactivated, null, dataModelIRI);
  const values = own.length > 0 ? own : store.getQuads(term, deactivated);
  return values.some((quad) => isTrue(quad.object));
}

// The data model with `term` (de)activated by a sh:deactivated triple in its own graph. That triple
// is left out when the imports already say the same.
export function setDeactivated(dataModel: DataModel, term: Resource, value: boolean): DataModel {
  const { store, dataModelIRI } = dataModel;
  const own = RdfStore.createDefault();
  for (const quad of ownQuads(dataModel)) {
    if (!(quad.subject.equals(term) && quad.predicate.equals(deactivated))) own.addQuad(quad);
  }
  const imported = store
    .getQuads(term, deactivated)
    .filter((quad) => !quad.graph.equals(dataModelIRI))
    .some((quad) => isTrue(quad.object));
  if (imported !== value) {
    own.addQuad(
      factory.quad(term, deactivated, factory.literal(String(value), xsd("boolean")), dataModelIRI),
    );
  }
  return commitEdit(dataModel, own);
}

// A NavLink's className: "st-deactivated" for a deactivated node, plus the link's own "active".
export const deactivatedClass =
  (dataModel: DataModel, term: Resource) =>
  ({ isActive }: { isActive: boolean }): string =>
    [isDeactivated(dataModel, term) && "st-deactivated", isActive && "active"]
      .filter(Boolean)
      .join(" ");

// Whether the data model's own graph says anything about `term`, so there is something to delete.
export const isOwn = ({ store, dataModelIRI }: DataModel, term: Resource): boolean =>
  store.getQuads(term, null, null, dataModelIRI).length > 0;

// The data model without `term`: what its own graph says about it, the blank nodes only it uses
// (a shape's property shapes, an rdf:List...), and the triples pointing to it - but not an RDF
// list's rdf:first, which would break the list. The imports are left as they are.
export function deleteNode(dataModel: DataModel, term: Resource): DataModel {
  const { store, dataModelIRI } = dataModel;
  const own = (subject: Term | null, object: Term | null) =>
    store.getQuads(subject, null, object, dataModelIRI);

  const removed = new Set([termKey(term)]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const quad of ownQuads(dataModel)) {
      const { object } = quad;
      if (!removed.has(termKey(quad.subject)) || object.termType !== "BlankNode") continue;
      if (removed.has(termKey(object))) continue;
      if (own(null, object).every((ref) => removed.has(termKey(ref.subject)))) {
        removed.add(termKey(object));
        grew = true;
      }
    }
  }

  const kept = RdfStore.createDefault();
  for (const quad of ownQuads(dataModel)) {
    if (removed.has(termKey(quad.subject))) continue;
    if (quad.object.equals(term) && !quad.predicate.equals(rdf("first"))) continue;
    kept.addQuad(quad);
  }
  return commitEdit(dataModel, kept);
}
