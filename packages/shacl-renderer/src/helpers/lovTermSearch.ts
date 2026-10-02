import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { owl, rdf, rdfs } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";

export type LovTermType = "class" | "property";

export type LovTerm = {
  uri: NamedNode;
  prefixedName: string;
  vocabularyPrefix: string;
  type: LovTermType;
};

// A static GitHub Pages mirror of LOV (Linked Open Vocabularies, lov.linkeddata.es): every LOV
// vocabulary re-published as one plain Turtle file under its LOV prefix, next to a small
// meta.json carrying the vocabulary's declared namespace. CORS-open (`Access-Control-Allow-
// Origin: *`, verified directly) and CDN-served, so this is a plain unauthenticated fetch - no
// Environment.corsProxyUrl needed. Being static files, there is no search API or SPARQL endpoint
// here at all: the mirror can only answer "which terms does vocabulary <prefix> have", never a
// free-text "which vocabulary has a term like <word>" - see searchLovTerms below.
export const LOV_MIRROR_URL = "https://ajuvercr.github.io/lov-mirror/";

// Mirrors the page size the previous live LOV search used, so the dropdown's LOV half stays the
// same length (useLovSuggestions caps its local half to match).
const PREFIX_MATCH_LIMIT = 10;

const ALL_LOV_TYPES: LovTermType[] = ["property", "class"];

// The rdf:type IRIs the crawled vocabulary files themselves use for each kind of term.
const KIND_BY_TYPE_IRI = new Map<string, LovTermType>([
  [rdf("Property").value, "property"],
  [owl("ObjectProperty").value, "property"],
  [owl("DatatypeProperty").value, "property"],
  [owl("AnnotationProperty").value, "property"],
  [rdfs("Class").value, "class"],
  [owl("Class").value, "class"],
]);

// Turtle's own PN_PREFIX grammar, near enough: letters, digits, "." "-" "_" (the mirror has
// prefixes like dbpedia-owl, juso.kr and authn_provider), starting with a letter. Anything else
// before the first colon isn't a vocabulary prefix worth a request - and it keeps every prefix
// URL-path-safe as-is, so no encoding is needed below.
const PREFIX_PATTERN = /^[A-Za-z][\w.-]*$/;

// Splits "skos:bro" into the vocabulary prefix ("skos") and the local text typed after it ("bro",
// possibly empty - a bare "skos:" is a legitimate "show me this vocabulary" query). A query with
// no colon, an invalid prefix, or a full IRI being typed/pasted ("http://...", where the text
// after the colon starts with "/") has no prefix, and so nothing the mirror can look up.
function splitCurieQuery(query: string): { prefix: string | undefined; localQuery: string } {
  const colonIndex = query.indexOf(":");
  if (colonIndex <= 0) return { prefix: undefined, localQuery: query };

  const prefix = query.slice(0, colonIndex);
  const localQuery = query.slice(colonIndex + 1);
  if (!PREFIX_PATTERN.test(prefix) || localQuery.startsWith("/")) {
    return { prefix: undefined, localQuery: query };
  }
  return { prefix, localQuery };
}

// Whether searchLovTerms can answer `query` at all (i.e. it names a vocabulary prefix) - lets a
// caller skip the whole async round-trip, loading state included, for a query it already knows
// will come back empty.
export function isLovSearchable(query: string): boolean {
  return splitCurieQuery(query).prefix !== undefined;
}

type VocabularyTerm = { localName: string; kinds: ReadonlySet<LovTermType> };
// `terms` is sorted by local name (codepoint order, the same as the previous SPARQL ORDER BY) and
// only holds terms inside the vocabulary's own namespace - some LOV files also type terms from
// other vocabularies they build on, which would carry the wrong prefix if reported here.
type MirrorVocabulary = { namespace: string; terms: VocabularyTerm[] };
type MirrorMeta = { namespace?: string };

async function fetchVocabulary(prefix: string): Promise<MirrorVocabulary | undefined> {
  const folder = `${LOV_MIRROR_URL}by-prefix/${prefix}/`;
  const [metaResponse, ontologyResponse] = await Promise.all([
    fetch(`${folder}meta.json`),
    fetch(`${folder}ontology.ttl`),
  ]);
  // A prefix LOV itself doesn't know has no folder on the mirror; the handful of LOV vocabularies
  // the mirror failed to fetch/convert have a meta.json but no ontology.ttl. Either way: nothing.
  if (metaResponse.status === 404 || ontologyResponse.status === 404) return undefined;
  for (const response of [metaResponse, ontologyResponse]) {
    if (!response.ok) {
      throw new Error(`LOV mirror request failed: ${response.status} ${response.statusText}`);
    }
  }

  const [meta, turtle] = await Promise.all([
    metaResponse.json() as Promise<MirrorMeta>,
    ontologyResponse.text(),
  ]);
  const namespace = meta.namespace;
  if (!namespace) return undefined;

  const kindsByLocalName = new Map<string, Set<LovTermType>>();
  const store = await parseRdf(turtle, "text/turtle");
  for (const quad of store.getQuads(null, rdf("type"), null)) {
    const kind = KIND_BY_TYPE_IRI.get(quad.object.value);
    if (!kind || quad.subject.termType !== "NamedNode") continue;
    if (!quad.subject.value.startsWith(namespace)) continue;
    const localName = quad.subject.value.slice(namespace.length);
    if (!localName) continue;
    kindsByLocalName.set(localName, (kindsByLocalName.get(localName) ?? new Set()).add(kind));
  }

  const terms = [...kindsByLocalName]
    .map(([localName, kinds]): VocabularyTerm => ({ localName, kinds }))
    .sort((a, b) => (a.localName < b.localName ? -1 : a.localName > b.localName ? 1 : 0));
  return { namespace, terms };
}

// One parsed vocabulary per prefix for the lifetime of the page: the same prefix is searched
// again on every keystroke after it ("skos:b", "skos:br", ...), and a vocabulary file can run to
// several MB (schema.org's is ~0.8 MB, a few outliers are far larger) - refetching and reparsing
// it per keystroke is out of the question. The in-flight promise is what's cached, so concurrent
// searches for one prefix share a single load. A prefix the mirror doesn't know (`undefined`) is
// cached too, so an unknown prefix costs one 404 rather than one per keystroke; a failed load
// (network error, 5xx) is evicted instead, so the next keystroke simply retries.
const vocabularyCache = new Map<string, Promise<MirrorVocabulary | undefined>>();

function loadVocabulary(prefix: string): Promise<MirrorVocabulary | undefined> {
  const cached = vocabularyCache.get(prefix);
  if (cached) return cached;

  const loading = fetchVocabulary(prefix);
  vocabularyCache.set(prefix, loading);
  loading.catch(() => vocabularyCache.delete(prefix));
  return loading;
}

// Test-only: the module-level cache above would otherwise leak one test's mocked vocabularies
// into the next.
export function clearLovVocabularyCache(): void {
  vocabularyCache.clear();
}

// True prefix (starts-with, case-insensitive) match over the typed local text, reporting each
// term as the first requested kind it has - so a `types` of just ["property"] never surfaces a
// class, and the default (both) still tags each match with what it actually is.
function searchVocabulary(
  vocabulary: MirrorVocabulary,
  prefix: string,
  localQuery: string,
  types: LovTermType[],
): LovTerm[] {
  const lowerQuery = localQuery.toLowerCase();
  const matches: LovTerm[] = [];
  for (const term of vocabulary.terms) {
    if (!term.localName.toLowerCase().startsWith(lowerQuery)) continue;
    const type = types.find((candidate) => term.kinds.has(candidate));
    if (!type) continue;
    matches.push({
      uri: factory.namedNode(vocabulary.namespace + term.localName),
      prefixedName: `${prefix}:${term.localName}`,
      vocabularyPrefix: prefix,
      type,
    });
    if (matches.length === PREFIX_MATCH_LIMIT) break;
  }
  return matches;
}

// Looks a typed CURIE ("skos:bro") up on the LOV mirror: the typed prefix is the mirror's own
// folder name, so the vocabulary is fetched on the fly the first time a prefix is typed (see
// loadVocabulary) and its terms starting with the typed local text are returned - a genuine (if
// empty) result set for a vocabulary LOV knows, nothing for a prefix it doesn't (e.g. this
// project's own "ex"/"st" style local prefixes... though note LOV does list vocabularies under
// both of those). A query with no prefix at all ("label") returns nothing: the mirror has no
// cross-vocabulary index that a static file host could serve at a sensible size, and querying it
// live means callers don't need to bundle/maintain any vocabulary term data of their own.
//
// `types` restricts the search to just classes, just properties, or (the default, when omitted -
// LOV itself has no other term kinds worth surfacing here) both at once.
export async function searchLovTerms(query: string, types?: LovTermType[]): Promise<LovTerm[]> {
  const requestedTypes = types && types.length > 0 ? types : ALL_LOV_TYPES;
  const { prefix, localQuery } = splitCurieQuery(query);
  if (prefix === undefined) return [];

  const vocabulary = await loadVocabulary(prefix);
  if (!vocabulary) return [];
  return searchVocabulary(vocabulary, prefix, localQuery, requestedTypes);
}

// Predicate-only convenience wrapper - PathItemModal's own suggestion source, kept as a named
// export since "search for a predicate" is a distinct, narrower intent than the generalized
// searchLovTerms (e.g. it never wants a class back, regardless of what the caller's shape allows).
export function searchLovProperties(query: string): Promise<LovTerm[]> {
  return searchLovTerms(query, ["property"]);
}
