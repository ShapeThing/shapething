import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NamedNode } from "@rdfjs/types";
import { localName } from "@/helpers/localName.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { prefixedIri } from "@/helpers/prefixedIri.tsx";
import {
  isLovSearchable,
  type LovTerm,
  type LovTermType,
  searchLovTerms,
} from "@/helpers/lovTermSearch.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";

const LOV_SEARCH_DEBOUNCE_MS = 200;
// lovTermSearch.ts's own 10-result cap already bounds that half of the list - this caps the local
// half the same way, so a large candidate list can't make the dropdown unbounded.
const MAX_LOCAL_SUGGESTIONS = 20;

export type Suggestion = { kind: "local"; iri: NamedNode } | {
  kind: "lov";
  term: LovTerm;
};

// Two suggestion sources for an IRI-typed autocomplete field: IRIs the caller already knows are
// relevant (instant, zero-latency, and the only source that can ever know about a project-
// specific/custom term LOV has never heard of - see knownPredicates.ts/knownIris.ts for the two
// current callers), and a live lookup against a static mirror of LOV (Linked Open Vocabularies)
// for published-vocabulary terms, once a vocabulary prefix has been typed ("skos:bro") -
// debounced, async, and only ever for a prefixed query, since the mirror has nothing to answer an
// unprefixed one with (see lovTermSearch.ts, also for why this is a network call rather than a
// bundled term list). `suggestions` puts local matches first since they're already visible by
// the time the mirror's request round-trips, so results only ever append, never reshuffle, once
// it responds. `lovTypes` scopes the LOV half to just classes, just properties, or (when
// omitted) both - see PathItemModal's usePredicateSuggestions (properties only) and IRIEditor's
// use (shape-configurable via st:iriType) for the two current callers.
//
// `enabled` gates the LOV half only (the local half stays free/instant either way): both callers
// pass their own combobox's `suggestionsOpen` state, since `query` is seeded from the field's
// already-committed value on mount (IRIEditor's `localValue`/PathItemModal's `predicateInput`
// both start from the current term, not empty) - without this gate, every rendered field with an
// existing value would fire a LOV search nobody asked for, not just ones the user is editing.
export function useLovSuggestions(
  candidates: NamedNode[],
  query: string,
  options?: { lovTypes?: LovTermType[]; enabled?: boolean },
): {
  suggestions: Suggestion[];
  isSearchingLov: boolean;
} {
  const { lovTypes, enabled = true } = options ?? {};
  const { sourcePrefixes } = useEnvironment();
  const [debounced, setDebounced] = useState<string>();

  useEffect(() => {
    if (!enabled || !query) {
      setDebounced(undefined);
      return;
    }
    const timeout = setTimeout(
      () => setDebounced(query),
      LOV_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [query, enabled]);

  // Only a query naming a vocabulary prefix can be answered at all (see lovTermSearch.ts) - an
  // unprefixed one is left disabled here rather than fired and answered empty, so the dropdown
  // never flashes the LOV half's loading row for it.
  const lovQuery = debounced !== undefined && isLovSearchable(debounced)
    ? debounced
    : undefined;

  // A LOV network failure degrades to "no LOV results" rather than being surfaced anywhere, so
  // React Query's own error state is deliberately left unread - `retry: false` avoids silently
  // triple-retrying (React Query's default) before giving up on something nobody sees anyway.
  const { data: lovResults, isLoading: isSearchingLov } = useQuery({
    queryKey: ["lov-term-search", lovQuery, lovTypes?.join(",")],
    queryFn: () => searchLovTerms(lovQuery ?? "", lovTypes),
    enabled: lovQuery !== undefined,
    ...noRefetch,
  });

  // Empty query -> no local matches, not "every candidate": an empty-string prefix technically
  // starts every candidate, but a bare focus (before any typing) opening onto the full candidate
  // list is exactly the "shows suggestions immediately" behavior callers don't want.
  //
  // Prefix (startsWith), not substring - checked against the candidate's local name (what a user
  // normally types, e.g. "alpha" for .../project-alpha), its full IRI (typing/pasting from the
  // very start of the URL), and its prefixed CURIE (typing e.g. "ex:proj") - never a mid-string
  // match against any of the three.
  const localMatches = query
    ? candidates
      .filter((candidate) => {
        const lowerQuery = query.toLowerCase();
        if (
          (localName(candidate) ?? "").toLowerCase().startsWith(lowerQuery)
        ) return true;
        if (candidate.value.toLowerCase().startsWith(lowerQuery)) return true;
        const prefixed = prefixedIri(candidate, sourcePrefixes);
        return prefixed !== undefined &&
          prefixed.toLowerCase().startsWith(lowerQuery);
      })
      .slice(0, MAX_LOCAL_SUGGESTIONS)
    : [];

  // A candidate already offered as a "local" match can also come back from the LOV mirror - its
  // prefix search finds an already-in-use skos:broader just as reliably as a brand-new one. Drop
  // it from the "lov" half so it doesn't render twice.
  const localUris = new Set(localMatches.map((candidate) => candidate.value));
  const lovMatches = (lovResults ?? []).filter((term) =>
    !localUris.has(term.uri.value)
  );

  const suggestions: Suggestion[] = [
    ...localMatches.map((iri): Suggestion => ({ kind: "local", iri })),
    ...lovMatches.map((term): Suggestion => ({ kind: "lov", term })),
  ];

  return {
    suggestions,
    isSearchingLov: lovQuery !== undefined && isSearchingLov,
  };
}
