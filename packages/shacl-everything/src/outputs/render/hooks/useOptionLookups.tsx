import { useQuery } from "@tanstack/react-query";
import type { NamedNode } from "@rdfjs/types";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { fetchOptions, type SearchResult } from "./localInstanceQuery.ts";

/**
 * Resolves every one of `iris`' LabelRole label/DepictionRole image in a single batched Comunica
 * query (see fetchOptions) - the shared "hydrate a fixed set of already-known values" mechanism
 * behind both EnumSelectEditor's sh:in options and AutoCompleteEditor's currently applied value,
 * so neither issues one query per value.
 */
export function useOptionLookups(shape: PropertyUIElement, iris: NamedNode[]): SearchResult[] {
  const { data } = useQuery({
    queryKey: [
      "option-lookups",
      shape.propertyShapes.map((s) => s.value),
      iris.map((iri) => iri.value),
    ],
    queryFn: () => fetchOptions(shape, iris).catch(() => []),
    enabled: iris.length > 0,
    ...noRefetch,
  });

  return data ?? [];
}
