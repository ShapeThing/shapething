import type { TypedQuery } from "@shapething/typed-sparql";
import type { BlankNode, Term } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import type { RdfStore } from "rdf-stores";

const factory = new DataFactory();

// Imported on first use, so nothing pays for Comunica until a query actually runs.
let enginePromise: Promise<import("@comunica/query-sparql-rdfjs").QueryEngine> | undefined;
function getEngine() {
  enginePromise ??= import("@comunica/query-sparql-rdfjs").then(
    ({ QueryEngine }) => new QueryEngine(),
  );
  return enginePromise;
}

// Runs a typed-sparql .rq SELECT against the in-memory store. The row type comes from the query's
// generated .rq.d.ts. `bindings` fills a query's input variables (e.g. ?origin) before it runs.
export async function select<TRow extends object>(
  query: TypedQuery<TRow>,
  store: RdfStore,
  bindings: Record<string, Term> = {},
): Promise<TRow[]> {
  const engine = await getEngine();
  const { BindingsFactory } = await import("@comunica/utils-bindings-factory");
  const initialBindings = new BindingsFactory(factory).fromRecord(
    Object.fromEntries(Object.entries(bindings).map(([name, term]) => [name, toQueryTerm(term)])),
  );
  // loadDataModel tags every quad with its graph IRI, nothing is in the default graph, so a
  // pattern outside GRAPH {} needs unionDefaultGraph to see any quads.
  const stream = await engine.queryBindings(query, {
    sources: [store],
    unionDefaultGraph: true,
    initialBindings,
  });
  const rows = await stream.toArray();
  return rows.map(
    (row) =>
      Object.fromEntries([...row].map(([{ value }, term]) => [value, toStoreTerm(term)])) as TRow,
  );
}

const SKOLEM_PREFIX = /^urn:comunica_skolem:source_\d+:/;

// A store blank node as an input binding, in the form Comunica gives the store's blank nodes in
// results (its BlankNodeScoped): labelled "bc_0_<label>" so it joins with them, and carrying the
// skolem IRI that Comunica turns back into the store's blank node when it asks the store. A raw
// blank node would match nothing. The store is the only source, source 0.
function toQueryTerm(term: Term): Term {
  if (term.termType !== "BlankNode") return term;
  const value = `bc_0_${term.value}`;
  return {
    termType: "BlankNode",
    value,
    skolemized: factory.namedNode(`urn:comunica_skolem:source_0:${term.value}`),
    equals: (other?: Term | null) => other?.termType === "BlankNode" && other.value === value,
  } as BlankNode;
}

// Comunica relabels blank nodes per source; the store's own label is kept on the skolem IRI.
function toStoreTerm(term: Term): Term {
  const skolemized = (term as { skolemized?: Term }).skolemized;
  if (term.termType !== "BlankNode" || skolemized?.termType !== "NamedNode") return term;
  return factory.blankNode(skolemized.value.replace(SKOLEM_PREFIX, ""));
}
