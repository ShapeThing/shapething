import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NamedNode } from "@rdfjs/types";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { searchQueryFor } from "@/widgets/implementations/shui/editors/AutoCompleteEditor/searchQuery.ts";
import { selectQueryFor } from "@/widgets/implementations/shui/editors/EnumSelectEditor/selectQuery.ts";
import { useInterfaceLanguage } from "./useInterfaceLanguage.tsx";
import { extractServiceEndpoint, fetchOptions, type SearchResult } from "./query.ts";

/**
 * Resolves every one of `iris`' LabelRole label/DepictionRole image in a single batched Comunica
 * query (see fetchOptions) - the shared "hydrate a fixed set of already-known values" mechanism
 * behind both EnumSelectEditor's sh:in options/currently applied value and AutoCompleteEditor's
 * currently applied value, so neither issues one query per value. When `shape` declares a
 * federated `shui:searchQuery` or `sh:in [ sh:select ... ]` (see searchQueryFor/selectQueryFor),
 * `iris` are resolved against that same remote endpoint instead of the local dataGraph - otherwise
 * a value whose roles only exist remotely (e.g. either editor's currently applied value,
 * re-hydrated on mount) would resolve to nothing every time.
 */
export function useOptionLookups(shape: PropertyUIElement, iris: NamedNode[]): SearchResult[] {
  const { activeInterfaceLanguage } = useInterfaceLanguage();
  const endpoint = useMemo(() => {
    const federatedQuery = searchQueryFor(shape) ?? selectQueryFor(shape);
    return federatedQuery ? extractServiceEndpoint(federatedQuery) : undefined;
  }, [shape]);

  const { data } = useQuery({
    queryKey: [
      "option-lookups",
      shape.propertyShapes.map((s) => s.value),
      iris.map((iri) => iri.value),
      endpoint,
      activeInterfaceLanguage,
    ],
    queryFn: () =>
      fetchOptions(shape, iris, { uiLanguage: activeInterfaceLanguage, endpoint }).catch((cause) => {
        console.error("[shacl-everything] option lookup failed", cause);
        return [];
      }),
    enabled: iris.length > 0,
    ...noRefetch,
  });

  return data ?? [];
}
