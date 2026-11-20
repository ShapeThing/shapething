import type { NamedNode, Term } from "@rdfjs/types";
import { select, sh, type QueryRow } from "@shapething/shacl-renderer";
import type { RdfStore } from "rdf-stores";
import type { MetaShapes } from "../app/MetaView.tsx";
import type { Origin } from "../app/paths.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { factory, termKey, type Resource } from "../data-model/rdf.ts";
import { cached } from "../data-model/storeCache.ts";
import { shaclMeta } from "./metaShapes.ts";
import shapeProperties from "./queries/shapeProperties.rq";
import sparqlConstraints from "./queries/sparqlConstraints.rq";
import shaclRules from "./queries/shaclRules.rq";
import type { Subject } from "./useSubject.ts";

type BestByLanguage = (values: Term[]) => Term | undefined;

// A tab of a shape, class or group page that lists nodes, each opening its own page.
export type ListTab = {
  label: string;
  empty: string;
  // A query binding ?subject, ?kind, ?dataModel and ?origin, and the column with the nodes.
  query: string;
  column: string;
  // The node's page param, and the shapes it is shown, edited and created through.
  param: string;
  shapes: MetaShapes;
  // What a new node is, and how the shape it is created on points to it.
  create: { label: string; kind: string; type: NamedNode; predicate: NamedNode };
  // For a node without any label.
  fallbackLabel?: (
    term: Resource,
    store: RdfStore,
    bestByLanguage: BestByLanguage,
  ) => string | undefined;
};

const listTab = <Query extends string>(
  tab: ListTab & { query: Query; column: keyof QueryRow<Query> & string },
): ListTab => tab;

export const listTabs = {
  properties: listTab({
    label: "Properties",
    empty: "No property shapes.",
    query: shapeProperties,
    column: "propertyShape",
    param: "property",
    shapes: shaclMeta.property,
    create: {
      label: "property",
      kind: "property",
      type: sh("PropertyShape"),
      predicate: sh("property"),
    },
    fallbackLabel: () => "(complex path)",
  }),
  queries: listTab({
    label: "Queries",
    empty: "No SPARQL-based constraints.",
    query: sparqlConstraints,
    column: "constraint",
    param: "constraint",
    shapes: shaclMeta.query,
    create: {
      label: "query",
      kind: "query",
      type: sh("SPARQLConstraint"),
      predicate: sh("sparql"),
    },
    // Constraints are mostly blank nodes: they read as their message.
    fallbackLabel: (term, store, bestByLanguage) =>
      bestByLanguage(store.getQuads(term, sh("message")).map((quad) => quad.object))?.value,
  }),
  rules: listTab({
    label: "Rules",
    empty: "No SHACL rules.",
    query: shaclRules,
    column: "rule",
    param: "rule",
    shapes: shaclMeta.rule,
    create: { label: "rule", kind: "rule", type: sh("SPARQLRule"), predicate: sh("rule") },
  }),
};

export type ListTabName = keyof typeof listTabs;

export const findListTab = (name: string | undefined): ListTab | undefined =>
  name && Object.hasOwn(listTabs, name) ? listTabs[name as ListTabName] : undefined;

export const subjectBindings = (subject: Subject, origin: Origin, { dataModelIRI }: DataModel) => ({
  subject: subject.term,
  kind: factory.literal(subject.kind),
  dataModel: dataModelIRI,
  origin: factory.literal(origin),
});

// The tab's nodes, once each, in query order.
export function listItems(
  dataModel: DataModel,
  tab: ListTab,
  subject: Subject,
  origin: Origin,
): Promise<Resource[]> {
  const { store } = dataModel;
  const key = `${tab.label} ${origin} ${subject.kind} ${termKey(subject.term)}`;
  return cached(store, key, async () => {
    const rows = await select(tab.query, store, subjectBindings(subject, origin, dataModel));
    const items = new Map<string, Resource>();
    for (const row of rows) {
      const item = row[tab.column] as Resource;
      if (!items.has(termKey(item))) items.set(termKey(item), item);
    }
    return [...items.values()];
  });
}
