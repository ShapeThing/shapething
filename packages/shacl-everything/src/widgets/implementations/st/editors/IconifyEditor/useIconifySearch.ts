import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { st } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

const SEARCH_DEBOUNCE_MS = 200;
const RESULT_LIMIT = 96;

async function searchIconify(query: string, collections: string[]): Promise<string[]> {
  const response = await fetch(
    `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${RESULT_LIMIT}`,
  );
  if (!response.ok) throw new Error(`Iconify search failed with status ${response.status}`);
  const body = (await response.json()) as { icons?: string[] };
  const icons = body.icons ?? [];
  return collections.length === 0
    ? icons
    : icons.filter((icon) => collections.some((collection) => icon.startsWith(`${collection}:`)));
}

/**
 * Search-as-you-type against the public `api.iconify.design/search` endpoint (the same one
 * shacl-renderer's own IconifyEditor called directly) - narrowed down to `shape`'s own
 * st:iconifyCollections (a property-shape-declared allowlist of icon set prefixes, e.g. "mdi",
 * "fluent-emoji") when any are configured. Mirrors useInstanceSearch's own
 * undefined-until-debounced/reset shape so IconifyEditor's dropdown-open logic can stay identical
 * to AutoCompleteEditor's.
 */
export function useIconifySearch(shape: PropertyUIElement): {
  search: string;
  setSearch: (value: string) => void;
  results: string[] | undefined;
  isLoading: boolean;
  error: unknown;
  reset: () => void;
} {
  const collections = useMemo(
    () => shape.get(st("iconifyCollections")).map((term) => term.value),
    [shape],
  );
  const [search, setSearch] = useState<string>();
  const [debounced, setDebounced] = useState<string>();

  useEffect(() => {
    if (search === undefined) return;
    const timeout = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["iconify-search", debounced, collections],
    queryFn: () =>
      searchIconify(debounced ?? "", collections).catch((cause) => {
        console.error("[shacl-everything] iconify search failed", cause);
        throw cause;
      }),
    enabled: !!debounced,
    ...noRefetch,
  });

  return {
    search: search ?? "",
    setSearch,
    results: debounced ? (data ?? []) : undefined,
    isLoading: !!debounced && isLoading,
    error: debounced ? error : undefined,
    reset: () => {
      setSearch(undefined);
      setDebounced(undefined);
    },
  };
}
