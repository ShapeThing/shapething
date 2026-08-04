import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { searchQueryFor } from "@/widgets/implementations/shui/editors/AutoCompleteEditor/searchQuery.ts";
import { useEnvironment } from "./useEnvironment.tsx";
import {
  runFederatedQuery,
  searchInstances,
  substituteSearchParameters,
  type SearchResult,
} from "./query.ts";

const SEARCH_DEBOUNCE_MS = 200;

/**
 * Runs `shape`'s `sh:in [ shui:searchQuery "..." ]` for `search`, substituting the spec's reserved
 * ?searchTerm/?uiLanguage parameters and resolving LabelRole/SubLabelRole/DepictionRole via
 * sh:node the same way a federated sh:select does (see useSelectOptions.tsx) - the fulltext-search
 * counterpart to searchInstances, for backends with their own text index. Non-NamedNode results
 * are dropped since AutoCompleteEditor only ever applies IRI values.
 */
async function runSearchQuery(
  shape: PropertyUIElement,
  query: string,
  search: string,
  uiLanguage: string,
): Promise<SearchResult[]> {
  const substituted = substituteSearchParameters(query, search, uiLanguage);
  const results = await runFederatedQuery(substituted, shape, uiLanguage);

  return results.flatMap((result): SearchResult[] =>
    result.term.termType === "NamedNode"
      ? [
          {
            iri: result.term,
            label: result.label,
            subLabel: result.subLabel,
            depiction: result.depiction,
          },
        ]
      : [],
  );
}

/**
 * Search-as-you-type against `shape`'s sh:class instances (see searchInstances) - or, when `shape`
 * declares a `shui:searchQuery`, against that federated query instead (see runSearchQuery).
 * `search` starts undefined - not yet debounced/queried at all - so opening an editor doesn't fire
 * a query until setSearch is actually called; `results` mirrors that by staying undefined until
 * then too, the same distinction AutoCompleteEditor's own state used to track by hand.
 */
export function useInstanceSearch(shape: PropertyUIElement): {
  search: string;
  setSearch: (value: string) => void;
  results: SearchResult[] | undefined;
  error: unknown;
  reset: () => void;
} {
  const { interfaceLanguage } = useEnvironment();
  const searchQuery = useMemo(() => searchQueryFor(shape), [shape]);
  const [search, setSearch] = useState<string>();
  const [debounced, setDebounced] = useState<string>();

  useEffect(() => {
    if (search === undefined) return;
    const timeout = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, error } = useQuery({
    queryKey: ["instance-search", shape.propertyShapes.map((s) => s.value), searchQuery, debounced],
    queryFn: () =>
      (searchQuery
        ? runSearchQuery(shape, searchQuery, debounced ?? "", interfaceLanguage)
        : searchInstances(shape, debounced ?? "")
      ).catch((cause) => {
        console.error("[shacl-everything] instance search failed", cause);
        throw cause;
      }),
    enabled: debounced !== undefined,
    ...noRefetch,
  });

  return {
    search: search ?? "",
    setSearch,
    results: debounced === undefined ? undefined : (data ?? []),
    error: debounced === undefined ? undefined : error,
    reset: () => {
      setSearch(undefined);
      setDebounced(undefined);
    },
  };
}
