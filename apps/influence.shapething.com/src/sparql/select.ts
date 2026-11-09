import type { Quad, Quad_Object, Quad_Predicate, Quad_Subject, Term } from "@rdfjs/types";
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

/** The query without its comment lines and indentation: less to send. */
export const compact = (queryString: string): string =>
  queryString
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");

/**
 * Runs a SPARQL query on the Wikidata query service: a row of terms by variable each. The query
 * service answers a CONSTRUCT in the same JSON, a row with a subject, predicate and object each.
 */
const run = async (queryString: string): Promise<Array<Record<string, Term>>> => {
  // A POST: a query can be longer than the query service allows in a URL. The browser caches the
  // answer under the URL of the query (see fetchJson).
  const body = new URLSearchParams({ query: compact(queryString) });
  const json = await fetchJson(
    ENDPOINT,
    { method: "POST", body, headers: { Accept: "application/sparql-results+json" } },
    true,
    `${ENDPOINT}?${body}`,
  );
  if (!isSparqlJsonResults(json))
    throw new Error("The query service did not answer with query results");

  return json.results.bindings.map((binding) =>
    Object.fromEntries(Object.entries(binding).map(([variable, term]) => [variable, toTerm(term)])),
  );
};

/**
 * Runs a typed-sparql SELECT query (an imported .rq file) on the Wikidata query service. The type
 * of a row comes from the .rq.d.ts typed-sparql generated for it: an unbound variable is left out
 * of its row, which the type marks as optional.
 */
export const select = async <Row extends object>(
  query: TypedQuery<Row>,
  parameters?: Parameters,
): Promise<Row[]> => (await run(parameterize(query, parameters))) as Row[];

/**
 * Runs a CONSTRUCT query (a .rq file imported with ?raw: typed-sparql only types SELECT queries) on
 * the Wikidata query service: its triples.
 */
export const construct = async (query: string, parameters?: Parameters): Promise<Quad[]> =>
  (await run(parameterize(query, parameters))).map((row) =>
    factory.quad(
      row.subject as Quad_Subject,
      row.predicate as Quad_Predicate,
      row.object as Quad_Object,
    ),
  );
