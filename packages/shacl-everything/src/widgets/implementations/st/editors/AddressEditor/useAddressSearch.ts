import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { noRefetch } from "@/helpers/noRefetch.ts";
import { st } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 10;

export type OsmAddress = {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
};

export type OsmSearchResult = {
  place_id: number;
  address: OsmAddress;
};

function searchUrl(query: string, countries: string[]): string {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: String(RESULT_LIMIT),
  });
  // Unlike shacl-renderer's own AddressEditor (which defaulted to `['nl']` when unset), an
  // unrestricted property shape here searches worldwide - a Dutch-only default is too surprising
  // for a general-purpose toolkit's own fallback behavior.
  if (countries.length > 0) params.set("countrycodes", countries.join(","));
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

async function searchAddresses(query: string, countries: string[]): Promise<OsmSearchResult[]> {
  const response = await fetch(searchUrl(query, countries));
  if (!response.ok) throw new Error(`Address search failed with status ${response.status}`);
  return (await response.json()) as OsmSearchResult[];
}

/**
 * Search-as-you-type against the public, unauthenticated Nominatim (OpenStreetMap) API - the same
 * one shacl-renderer's own AddressEditor called directly - narrowed down to `shape`'s own
 * st:osmCountries (a property-shape-declared allowlist of ISO 3166-1 alpha-2 country codes, e.g.
 * "nl") when any are configured. Mirrors useIconifySearch's own undefined-until-debounced/reset
 * shape.
 */
export function useAddressSearch(shape: PropertyUIElement): {
  search: string;
  setSearch: (value: string) => void;
  results: OsmSearchResult[] | undefined;
  isLoading: boolean;
  error: unknown;
  reset: () => void;
} {
  const countries = useMemo(() => shape.get(st("osmCountries")).map((term) => term.value), [shape]);
  const [search, setSearch] = useState<string>();
  const [debounced, setDebounced] = useState<string>();

  useEffect(() => {
    if (search === undefined) return;
    const timeout = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["address-search", debounced, countries],
    queryFn: () =>
      searchAddresses(debounced ?? "", countries).catch((cause) => {
        console.error("[shacl-everything] address search failed", cause);
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
