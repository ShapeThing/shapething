import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NamedNode } from "@rdfjs/types";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { prefixedIri } from "@/helpers/prefixedIri.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { knownPredicates } from "./knownPredicates.ts";
import { searchLovProperties, type LovTerm } from "./lovTermSearch.ts";

const LOV_SEARCH_DEBOUNCE_MS = 200;
// LOV's own page_size=10 (see lovTermSearch.ts) already caps that half of the list - this caps
// the local half the same way, so a large data graph can't make the dropdown unbounded.
const MAX_LOCAL_SUGGESTIONS = 20;

export type Suggestion =
  | { kind: "local"; predicate: NamedNode }
  | { kind: "lov"; term: LovTerm };

// Two suggestion sources for PathItemModal's predicate field: predicates already used somewhere
// in this shape's own shapes+data graphs (instant, zero-latency, and the only source that can
// ever know about a project-specific/custom predicate LOV has never heard of), and a live search
// against LOV (Linked Open Vocabularies) for published-vocabulary properties (debounced, async -
// see lovTermSearch.ts for why this is a real network call rather than a bundled term list).
// `suggestions` puts local matches first since they're already visible by the time LOV's request
// round-trips, so results only ever append, never reshuffle, once LOV responds.
export function usePredicateSuggestions(
  shape: PropertyUIElement,
  query: string,
): {
  suggestions: Suggestion[];
  isSearchingLov: boolean;
  lovError: unknown;
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

  const {
    data: lovResults,
    isLoading: isSearchingLov,
    error: lovError,
  } = useQuery({
    queryKey: ["lov-property-search", debounced],
    queryFn: () => searchLovProperties(debounced ?? ""),
    enabled: debounced !== undefined,
    ...noRefetch,
  });

  const localMatches = knownPredicates(shape.dataGraph, shape.shapesGraph)
    .filter((predicate) => {
      if (!query) return true;
      const lowerQuery = query.toLowerCase();
      if (predicate.value.toLowerCase().includes(lowerQuery)) return true;
      const prefixed = prefixedIri(predicate);
      return prefixed !== undefined && prefixed.toLowerCase().includes(lowerQuery);
    })
    .slice(0, MAX_LOCAL_SUGGESTIONS);

  const suggestions: Suggestion[] = [
    ...localMatches.map((predicate): Suggestion => ({ kind: "local", predicate })),
    ...(lovResults ?? []).map((term): Suggestion => ({ kind: "lov", term })),
  ];

  return {
    suggestions,
    isSearchingLov: debounced !== undefined && isSearchingLov,
    lovError: debounced !== undefined ? lovError : undefined,
  };
}
