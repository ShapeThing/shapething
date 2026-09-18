import type { TypedQuery } from "@shapething/typed-sparql";
import type { RdfStore } from "rdf-stores";

// Dynamically imported and cached so nothing pays for Comunica's SPARQL engine until a query
// actually runs - mirrors shacl-everything's outputs/render/hooks/query.ts.
let enginePromise:
  | Promise<import("@comunica/query-sparql-rdfjs").QueryEngine>
  | undefined;
function getEngine() {
  enginePromise ??= import("@comunica/query-sparql-rdfjs").then(
    ({ QueryEngine }) => new QueryEngine(),
  );
  return enginePromise;
}

// Runs a typed-sparql .rq SELECT query (see src/queries/) against a local RdfStore, mapping
// Comunica's generic Bindings rows onto plain objects shaped by the query's TypedQuery<TRow>
// phantom type, which TypeScript infers from the `query` argument itself.
export async function select<TRow extends object>(
  query: TypedQuery<TRow>,
  store: RdfStore,
): Promise<TRow[]> {
  const engine = await getEngine();
  // dataModel.ts tags every quad with an explicit named graph (the ontology IRI, or the fetched
  // graph URL as a fallback) - nothing ever lands in the default graph - so a GRAPH-less query
  // like owlImports.rq needs unionDefaultGraph to see any quads at all.
  const bindingsStream = await engine.queryBindings(query, {
    sources: [store],
    unionDefaultGraph: true,
  });
  const bindings = await bindingsStream.toArray();
  return bindings.map(
    (binding) =>
      Object.fromEntries(
        [...binding].map(([{ value }, term]) => [value, term]),
      ) as TRow,
  );
}
