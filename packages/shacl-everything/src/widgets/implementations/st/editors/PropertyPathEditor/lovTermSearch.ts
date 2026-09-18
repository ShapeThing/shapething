import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";

export type LovTerm = {
  uri: NamedNode;
  prefixedName: string;
  vocabularyPrefix: string | undefined;
};

type LovSearchResponse = {
  results?: {
    uri: string;
    prefixedName: string;
    vocabulary?: { prefix?: string };
  }[];
};

// LOV's own search index (both this API and https://lov.linkeddata.es/dataset/terms itself)
// matches local names/labels, not "prefix:localName" CURIE syntax as one token - a literal query
// of "skos:broader" returns zero results there, even though "broader" alone finds skos:broader as
// its own top-ranked match. Splitting the typed prefix off first means a user who already knows
// (or copied) the CURIE they want still finds it - see searchLovProperties below for how the
// stripped-off prefix is put back to work re-ranking the results instead of just being discarded.
function splitCurieQuery(query: string): { prefix: string | undefined; localQuery: string } {
  const colonIndex = query.indexOf(":");
  if (colonIndex <= 0 || colonIndex === query.length - 1) {
    return { prefix: undefined, localQuery: query };
  }
  return { prefix: query.slice(0, colonIndex), localQuery: query.slice(colonIndex + 1) };
}

// LOV (Linked Open Vocabularies, lov.linkeddata.es) indexes properties across hundreds of
// published vocabularies - querying it live means PathItemModal's predicate autocomplete doesn't
// need to bundle/maintain any vocabulary term data of its own. `term/search` (not the sibling
// `term/autocomplete` endpoint, which errors on LOV's own current deployment regardless of
// parameters) is CORS-open (`Access-Control-Allow-Origin: *`, verified directly), so this is a
// plain unauthenticated fetch - no Environment.corsProxyUrl needed. `query` must be non-empty;
// LOV's own API 400s on an empty `q`.
export async function searchLovProperties(query: string): Promise<LovTerm[]> {
  const { prefix, localQuery } = splitCurieQuery(query);
  const url = `https://lov.linkeddata.es/dataset/api/v2/term/search?type=property&page_size=10&q=${encodeURIComponent(localQuery)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`LOV term search failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as LovSearchResponse;
  const terms = (body.results ?? []).map((result) => ({
    uri: factory.namedNode(result.uri),
    prefixedName: result.prefixedName,
    vocabularyPrefix: result.vocabulary?.prefix,
  }));
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
