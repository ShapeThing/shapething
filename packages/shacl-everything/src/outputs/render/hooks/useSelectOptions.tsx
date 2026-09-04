import { useQuery } from "@tanstack/react-query";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { useEnvironment } from "./useEnvironment.tsx";
import { useInterfaceLanguage } from "./useInterfaceLanguage.tsx";
import { runFederatedQuery, type ResolvedTerm } from "./query.ts";

export type ResolvedOption = ResolvedTerm;

/**
 * `query` is the raw sh:select SPARQL text (see selectQuery.ts), or undefined when a property's
 * sh:in is a plain rdf:List instead - stays disabled and returns undefined in that case, the same
 * "no fetch pending" signal useInstanceSearch's `results` uses.
 */
export function useSelectOptions(
  shape: PropertyUIElement,
  query: string | undefined,
): { options: ResolvedOption[] | undefined; isLoading: boolean; error: unknown } {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const { corsProxyUrl } = useEnvironment();
  const { data, isLoading, error } = useQuery({
    queryKey: ["select-options", query, activeInterfaceLanguage],
    queryFn: () =>
      runFederatedQuery(query as string, shape, activeInterfaceLanguage, corsProxyUrl).catch(
        (cause) => {
          console.error("[shacl-everything] sh:select query failed", cause);
          throw cause;
        },
      ),
    enabled: query !== undefined,
    ...noRefetch,
  });

  return {
    options: query === undefined ? undefined : (data ?? []),
    isLoading: query !== undefined && isLoading,
    error: query === undefined ? undefined : error,
  };
}
