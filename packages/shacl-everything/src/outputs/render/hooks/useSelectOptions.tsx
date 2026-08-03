import { useQuery } from "@tanstack/react-query";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { useEnvironment } from "./useEnvironment.tsx";
import { runFederatedQuery, type FederatedResult } from "./federatedQuery.ts";

export type ResolvedOption = FederatedResult;

/**
 * `query` is the raw sh:select SPARQL text (see selectQuery.ts), or undefined when a property's
 * sh:in is a plain rdf:List instead - stays disabled and returns undefined in that case, the same
 * "no fetch pending" signal useInstanceSearch's `results` uses. Unlike useInstanceSearch/
 * useOptionLookups (which only ever read the already-loaded local dataGraph via the lightweight
 * query-sparql-rdfjs-lite engine), this uses the full @comunica/query-sparql engine (see
 * runFederatedQuery) - SERVICE clauses need real HTTP fetching and SPARQL-endpoint source
 * resolution, which query-sparql-rdfjs-lite doesn't bundle.
 */
export function useSelectOptions(
  shape: PropertyUIElement,
  query: string | undefined,
): ResolvedOption[] | undefined {
  const { interfaceLanguage } = useEnvironment();
  const { data } = useQuery({
    queryKey: ["select-options", query, interfaceLanguage],
    queryFn: () => runFederatedQuery(query as string, shape, interfaceLanguage).catch(() => []),
    enabled: query !== undefined,
    ...noRefetch,
  });

  return query === undefined ? undefined : (data ?? []);
}
