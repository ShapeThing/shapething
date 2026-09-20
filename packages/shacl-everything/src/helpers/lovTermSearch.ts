import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";

export type LovTermType = "class" | "property";

export type LovTerm = {
  uri: NamedNode;
  prefixedName: string;
  vocabularyPrefix: string | undefined;
  type: LovTermType;
};

type LovSearchResponse = {
  results?: {
    type?: string;
    uri: string;
    prefixedName: string;
    vocabulary?: { prefix?: string };
  }[];
};

type LovSparqlBinding = Record<string, { value: string } | undefined>;
type LovSparqlResponse = { results?: { bindings?: LovSparqlBinding[] } };

const ALL_LOV_TYPES: LovTermType[] = ["property", "class"];

// The rdf:type IRIs LOV's own crawled vocabulary triples use for each kind of term - matched
// against LOV's SPARQL endpoint (see searchTermsByNamespacePrefix below), not against term/search
// (which reports its own "type" field directly per result, no mapping needed there).
const TYPE_RDF_TERMS: Record<LovTermType, string[]> = {
  property: ["rdf:Property", "owl:ObjectProperty", "owl:DatatypeProperty", "owl:AnnotationProperty"],
  class: ["rdfs:Class", "owl:Class"],
};

// LOV's own search index (both this API and https://lov.linkeddata.es/dataset/terms itself)
// matches local names/labels, not "prefix:localName" CURIE syntax as one token - a literal query
// of "skos:broader" returns zero results there, even though "broader" alone finds skos:broader as
// its own top-ranked match. Splitting the typed prefix off first means a user who already knows
// (or copied) the CURIE they want still finds it - see searchLovTerms below for how the
// stripped-off prefix is put back to work re-ranking the results instead of just being discarded.
function splitCurieQuery(query: string): { prefix: string | undefined; localQuery: string } {
  const colonIndex = query.indexOf(":");
  if (colonIndex <= 0 || colonIndex === query.length - 1) {
    return { prefix: undefined, localQuery: query };
  }
  return { prefix: query.slice(0, colonIndex), localQuery: query.slice(colonIndex + 1) };
}

const LOV_SPARQL_ENDPOINT = "https://lov.linkeddata.es/dataset/sparql";
// Mirrors term/search's own page_size=10 (see searchLovTerms below).
const SPARQL_PREFIX_MATCH_LIMIT = 10;

// Neutralizes characters the SPARQL grammar treats specially inside a '"'-delimited string
// literal - both the typed prefix and the typed local text land here as raw user input.
function escapeSparqlLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

async function runLovSparqlSelect(query: string): Promise<LovSparqlBinding[]> {
  const url = `${LOV_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
  if (!response.ok) {
    throw new Error(`LOV SPARQL query failed: ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as LovSparqlResponse;
  return body.results?.bindings ?? [];
}

// LOV's dataset/sparql endpoint hosts the actual crawled vocabulary triples (not just LOV's own
// term-search index), including each vocabulary's vann:preferredNamespacePrefix/-Uri declaration.
// Resolving a typed CURIE prefix against it is what lets searchTermsByNamespacePrefix below do a
// real starts-with match instead of term/search's tokenized full-text one.
async function resolveLovNamespace(prefix: string): Promise<string | undefined> {
  const bindings = await runLovSparqlSelect(`PREFIX vann: <http://purl.org/vocab/vann/>
SELECT ?ns WHERE {
  ?vocab vann:preferredNamespacePrefix ?p .
  ?vocab vann:preferredNamespaceUri ?ns .
  FILTER(LCASE(STR(?p)) = "${escapeSparqlLiteral(prefix.toLowerCase())}")
} LIMIT 1`);
  return bindings[0]?.ns?.value;
}

// One `{ ?prop a ?type . FILTER(?type IN (...)) BIND("<kind>" AS ?kind) }` block per requested
// type, joined with UNION - so a single query can still report which kind (class vs property)
// each matched IRI actually is, the same way term/search's own "type" field already does.
function typeUnionClauses(types: LovTermType[]): string {
  return types
    .map(
      (type) =>
        `{ ?prop a ?type . FILTER(?type IN (${TYPE_RDF_TERMS[type].join(", ")})) BIND("${type}" AS ?kind) }`,
    )
    .join("\nUNION\n");
}

// True prefix (starts-with) search over one already-resolved vocabulary namespace. The namespace
// is baked into the query text as a literal rather than left as a joined `?ns` variable - doing
// vocabulary-prefix resolution and this term scan as one combined query reliably times out on
// LOV's backend, so the two stay separate round-trips (resolveLovNamespace above, then this).
async function searchTermsByNamespacePrefix(
  namespace: string,
  localQuery: string,
  types: LovTermType[],
): Promise<{ uri: string; type: LovTermType }[]> {
  const prefixText = escapeSparqlLiteral((namespace + localQuery).toLowerCase());
  const bindings = await runLovSparqlSelect(`PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?prop ?kind WHERE {
  ${typeUnionClauses(types)}
  FILTER(STRSTARTS(LCASE(STR(?prop)), "${prefixText}"))
} ORDER BY ?prop LIMIT ${SPARQL_PREFIX_MATCH_LIMIT}`);
  return bindings
    .filter((binding) => binding.prop?.value && binding.prop.value.length > namespace.length)
    .map((binding) => ({ uri: binding.prop!.value, type: binding.kind!.value as LovTermType }));
}

// Resolves a typed CURIE prefix to its vocabulary namespace, then finds terms whose IRI actually
// starts with `namespace + localQuery` - unlike term/search's tokenized full-text index, this
// returns nothing for a typed prefix LOV doesn't recognize, and a genuine (if empty) result set
// for one it does. `prefixedName`/`vocabularyPrefix` are reconstructed from the typed prefix
// itself rather than re-resolved, since resolveLovNamespace already confirmed it maps to this
// namespace. Returns undefined (not []) when the prefix itself doesn't resolve, so callers can
// tell "no vocabulary by that prefix" apart from "vocabulary found, nothing starts with that text".
async function searchByResolvedPrefix(
  prefix: string,
  localQuery: string,
  types: LovTermType[],
): Promise<LovTerm[] | undefined> {
  const namespace = await resolveLovNamespace(prefix);
  if (!namespace) return undefined;

  const terms = await searchTermsByNamespacePrefix(namespace, localQuery, types);
  return terms.map(({ uri, type }) => ({
    uri: factory.namedNode(uri),
    prefixedName: `${prefix}:${uri.slice(namespace.length)}`,
    vocabularyPrefix: prefix,
    type,
  }));
}

// LOV (Linked Open Vocabularies, lov.linkeddata.es) indexes classes and properties across
// hundreds of published vocabularies - querying it live means callers don't need to bundle/
// maintain any vocabulary term data of their own. `term/search` (not the sibling `term/
// autocomplete` endpoint, which errors on LOV's own current deployment regardless of parameters)
// is CORS-open (`Access-Control-Allow-Origin: *`, verified directly), so this is a plain
// unauthenticated fetch - no Environment.corsProxyUrl needed. `query` must be non-empty; LOV's
// own API 400s on an empty `q`.
//
// `types` restricts the search to just classes, just properties, or (the default, when omitted -
// LOV itself has no other term kinds worth surfacing here) both at once. A single requested type
// is passed straight through as term/search's own `type` filter; two (or none) omits it entirely,
// since LOV's API doesn't accept a comma-separated list and dropping the param already returns
// every kind mixed together, each tagged with its own "type" field.
export async function searchLovTerms(query: string, types?: LovTermType[]): Promise<LovTerm[]> {
  const requestedTypes = types && types.length > 0 ? types : ALL_LOV_TYPES;
  const { prefix, localQuery } = splitCurieQuery(query);

  // A typed CURIE prefix gets one shot at a real starts-with match against LOV's SPARQL endpoint
  // first (see searchByResolvedPrefix) - term/search's own tokenized index can badly rank (or miss
  // entirely) a short in-progress local name like "br". Any failure here (network error, LOV's
  // SPARQL backend down, an unresolvable prefix) just falls through to the existing term/search
  // flow below rather than breaking the search - this is a best-effort enhancement, not the only path.
  if (prefix && localQuery) {
    try {
      const prefixTerms = await searchByResolvedPrefix(prefix, localQuery, requestedTypes);
      if (prefixTerms && prefixTerms.length > 0) return prefixTerms;
    } catch {
      // fall through to term/search below
    }
  }

  const typeParam = requestedTypes.length === 1 ? `type=${requestedTypes[0]}&` : "";
  const url = `https://lov.linkeddata.es/dataset/api/v2/term/search?${typeParam}page_size=10&q=${encodeURIComponent(localQuery)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`LOV term search failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as LovSearchResponse;
  const terms = (body.results ?? []).map(
    (result): LovTerm => ({
      uri: factory.namedNode(result.uri),
      prefixedName: result.prefixedName,
      vocabularyPrefix: result.vocabulary?.prefix,
      type: result.type === "class" ? "class" : "property",
    }),
  );
  if (!prefix) return terms;

  // Re-ranks (doesn't filter) by the typed prefix - a match is put first when one exists, but a
  // prefix LOV doesn't recognize (e.g. this project's own "ex"/"st") still leaves every other
  // local-name match in place rather than hiding them all.
  const lowerPrefix = prefix.toLowerCase();
  return terms.toSorted((a, b) => {
    const aMatches = a.vocabularyPrefix?.toLowerCase() === lowerPrefix;
    const bMatches = b.vocabularyPrefix?.toLowerCase() === lowerPrefix;
    return aMatches === bMatches ? 0 : aMatches ? -1 : 1;
  });
}

// Predicate-only convenience wrapper - PathItemModal's own suggestion source, kept as a named
// export since "search for a predicate" is a distinct, narrower intent than the generalized
// searchLovTerms (e.g. it never wants a class back, regardless of what the caller's shape allows).
export function searchLovProperties(query: string): Promise<LovTerm[]> {
  return searchLovTerms(query, ["property"]);
}
