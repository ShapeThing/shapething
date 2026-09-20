import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NamedNode } from "@rdfjs/types";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { prefixedIri } from "@/helpers/prefixedIri.ts";
import { searchLovTerms, type LovTerm, type LovTermType } from "@/helpers/lovTermSearch.ts";

const LOV_SEARCH_DEBOUNCE_MS = 200;
// LOV's own page_size=10 (see lovTermSearch.ts) already caps that half of the list - this caps
// the local half the same way, so a large candidate list can't make the dropdown unbounded.
const MAX_LOCAL_SUGGESTIONS = 20;

export type Suggestion = { kind: "local"; iri: NamedNode } | { kind: "lov"; term: LovTerm };

// Two suggestion sources for an IRI-typed autocomplete field: IRIs the caller already knows are
// relevant (instant, zero-latency, and the only source that can ever know about a project-
// specific/custom term LOV has never heard of - see knownPredicates.ts/knownIris.ts for the two
// current callers), and a live search against LOV (Linked Open Vocabularies) for published-
// vocabulary terms (debounced, async - see lovTermSearch.ts for why this is a real network call
// rather than a bundled term list). `suggestions` puts local matches first since they're already
// visible by the time LOV's request round-trips, so results only ever append, never reshuffle,
// once LOV responds. `lovTypes` scopes the LOV half to just classes, just properties, or (when
// omitted) both - see PathItemModal's usePredicateSuggestions (properties only) and IRIEditor's
// use (shape-configurable via st:iriType) for the two current callers.
export function useLovSuggestions(
  candidates: NamedNode[],
  query: string,
  lovTypes?: LovTermType[],
): {
  suggestions: Suggestion[];
  isSearchingLov: boolean;
} {
  const [debounced, setDebounced] = useState<string>();

  useEffect(() => {
    if (!query) {
      setDebounced(undefined);
      return;
    }
    const timeout = setTimeout(() => setDebounced(query), LOV_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  // A LOV network failure degrades to "no LOV results" rather than being surfaced anywhere, so
  // React Query's own error state is deliberately left unread - `retry: false` avoids silently
  // triple-retrying (React Query's default) before giving up on something nobody sees anyway.
  const { data: lovResults, isLoading: isSearchingLov } = useQuery({
    queryKey: ["lov-term-search", debounced, lovTypes?.join(",")],
    queryFn: () => searchLovTerms(debounced ?? "", lovTypes),
    enabled: debounced !== undefined,
    retry: false,
    ...noRefetch,
  });

  const localMatches = candidates
    .filter((candidate) => {
      if (!query) return true;
      const lowerQuery = query.toLowerCase();
      if (candidate.value.toLowerCase().includes(lowerQuery)) return true;
      const prefixed = prefixedIri(candidate);
      return prefixed !== undefined && prefixed.toLowerCase().includes(lowerQuery);
    })
    .slice(0, MAX_LOCAL_SUGGESTIONS);

  // A candidate already offered as a "local" match can also come back from LOV's own search - e.g.
  // lovTermSearch's SPARQL prefix search finds an already-in-use skos:broader just as reliably as
  // a brand-new one. Drop it from the "lov" half so it doesn't render twice.
  const localUris = new Set(localMatches.map((candidate) => candidate.value));
  const lovMatches = (lovResults ?? []).filter((term) => !localUris.has(term.uri.value));

  const suggestions: Suggestion[] = [
    ...localMatches.map((iri): Suggestion => ({ kind: "local", iri })),
    ...lovMatches.map((term): Suggestion => ({ kind: "lov", term })),
  ];

  return {
    suggestions,
    isSearchingLov: debounced !== undefined && isSearchingLov,
  };
}
