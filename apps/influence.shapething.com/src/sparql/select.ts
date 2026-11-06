import type { Term } from "@rdfjs/types";
import type { TypedQuery } from "@shapething/typed-sparql";
import { factory } from "../rdf/namespaces.ts";
import { fetchJson } from "./fetchJson.ts";
import { parameterize, type Parameters } from "./parameterize.ts";

const ENDPOINT = "https://query.wikidata.org/sparql";

type SparqlJsonTerm = {
  type: "uri" | "bnode" | "literal" | "typed-literal";
  value: string;
  "xml:lang"?: string;
  datatype?: string;
};

type SparqlJsonResults = {
  head: { vars: string[] };
  results: { bindings: Array<Record<string, SparqlJsonTerm>> };
};

const isSparqlJsonResults = (json: unknown): json is SparqlJsonResults =>
  typeof json === "object" &&
  json !== null &&
  Array.isArray((json as SparqlJsonResults).results?.bindings);

const toTerm = (term: SparqlJsonTerm): Term => {
  switch (term.type) {
    case "uri":
      return factory.namedNode(term.value);
    case "bnode":
      return factory.blankNode(term.value);
    case "literal":
    case "typed-literal":
      if (term["xml:lang"]) return factory.literal(term.value, term["xml:lang"]);
      if (term.datatype) return factory.literal(term.value, factory.namedNode(term.datatype));
      return factory.literal(term.value);
    default:
      throw new Error(`Unsupported term in the query results: ${JSON.stringify(term)}`);
  }
};

/**
 * Runs a typed-sparql SELECT query (an imported .rq file) on the Wikidata query service. The type
 * of a row comes from the .rq.d.ts typed-sparql generated for it: an unbound variable is left out
 * of its row, which the type marks as optional.
 */
export const select = async <Row extends object>(
  query: TypedQuery<Row>,
  parameters?: Parameters,
): Promise<Row[]> => {
  const url = `${ENDPOINT}?${new URLSearchParams({ query: parameterize(query, parameters) })}`;
  const json = await fetchJson(
    url,
    { headers: { Accept: "application/sparql-results+json" } },
    true,
  );
  if (!isSparqlJsonResults(json))
    throw new Error("The query service did not answer with query results");

  return json.results.bindings.map(
    (binding) =>
      Object.fromEntries(
        Object.entries(binding).map(([variable, term]) => [variable, toTerm(term)]),
      ) as Row,
  );
};
