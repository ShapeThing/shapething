import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Bindings, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColorBucket } from "@/helpers/colorBuckets.ts";
import { noRefetch } from "@/helpers/noRefetch.ts";
import type { QuerySource } from "@/helpers/queryEngine.ts";
import { compileFilter, type CompileOptions } from "@/facets/compileFilter.ts";
import {
  colorBucketCountsQuery,
  facetQueryRunner,
  matchCountQuery,
  parseColorBucketCounts,
  parseMatchCount,
  parseValueBounds,
  parseValueCounts,
  toCountMap,
  valueBoundsQuery,
  valueCountsQuery,
  type FacetQueryRunner,
  type ValueBounds,
} from "@/facets/facetQueries.ts";
import type { FilterShape } from "@/facets/filterShape.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";

/**
 * Facet mode's data layer: every value, count and bound a facet shows is a SPARQL query (see
 * facets/facetQueries.ts), run through one Comunica engine against FacetSource - the local
 * dataGraph, or Environment.facetsEndpoint. Widgets pull only what they need through the hooks
 * below (useFacetValues, useFacetValueCounts, useFacetValueBounds, useFacetColorBuckets), so a text
 * search box never pays for per-option counts it doesn't show.
 */

export type FacetSource = {
  source: QuerySource;
  // Identifies `source` in query cache keys - the endpoint URL, or "local".
  sourceKey: string;
  run: FacetQueryRunner;
  compileOptions: CompileOptions;
  filterShape: FilterShape;
  // compileTargets() output for the currently active root shape(s).
  targets: string;
  countsEnabled: boolean;
};

const FacetSourceContext = createContext<FacetSource | undefined>(undefined);

export function FacetSourceProvider({ value, children }: { value: FacetSource; children: ReactNode }) {
  return <FacetSourceContext.Provider value={value}>{children}</FacetSourceContext.Provider>;
}

export function useFacetSource(): FacetSource {
  const value = useContext(FacetSourceContext);
  if (!value) throw new Error("useFacetSource must be used inside facet mode");
  return value;
}

/** The FacetSource for `dataGraph` or, when set, `facetsEndpoint`. */
export function useFacetSourceValue({
  dataGraph,
  shapesGraph,
  facetsEndpoint,
  corsProxyUrl,
  filterShape,
  targets,
  countsEnabled,
}: {
  dataGraph: RdfStore;
  shapesGraph: RdfStore;
  facetsEndpoint?: string;
  corsProxyUrl?: string;
  filterShape: FilterShape;
  targets: string;
  countsEnabled: boolean;
}): FacetSource {
  const base = useMemo(() => {
    const source: QuerySource = facetsEndpoint
      ? { kind: "endpoint", url: facetsEndpoint }
      : { kind: "local", store: dataGraph };
    return {
      source,
      sourceKey: facetsEndpoint ?? "local",
      run: facetQueryRunner(source, { corsProxyUrl }),
      compileOptions: {
        classGraphs: facetsEndpoint ? [shapesGraph] : [shapesGraph, dataGraph],
      },
    };
  }, [dataGraph, shapesGraph, facetsEndpoint, corsProxyUrl]);
  return useMemo(
    () => ({ ...base, filterShape, targets, countsEnabled }),
    [base, filterShape, targets, countsEnabled],
  );
}

// How long a facet waits after the filter shape last changed before re-querying - typing in a
// search box or range input writes a constraint per keystroke, and each write would otherwise send
// every other facet's count queries to the source again.
const FILTER_DEBOUNCE_MS = 150;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

/**
 * `filterShape`'s constraints compiled to a SPARQL pattern (optionally leaving out one facet's own
 * path), kept live: compileFilter reads the reactive filter store, so useReactiveRead re-runs it
 * exactly when a constraint changes. The compiled text doubles as the query cache key - no separate
 * revision counter needed. Debounced, see FILTER_DEBOUNCE_MS.
 */
export function useCompiledFilter(excludePath?: string): string {
  const { filterShape, compileOptions } = useFacetSource();
  const compiled = useReactiveRead(
    filterShape.store,
    `${filterShape.rootNode.value}|compiled-filter|${excludePath ?? ""}|${compileOptions.classGraphs.length}`,
    () => compileFilter(filterShape, { ...compileOptions, excludePath }),
  );
  return useDebounced(compiled, FILTER_DEBOUNCE_MS);
}

/**
 * Runs `query` (undefined = disabled) against the facet source. The cache holds the raw bindings,
 * keyed on the query text alone - two hooks asking the identical question (e.g. a facet's option
 * list and its counts, before any other facet narrows them) share one request, each parsing the
 * result its own way. `parse` must be pure.
 */
export function useFacetQueryResult<T>(
  query: string | undefined,
  parse: (bindings: Bindings[]) => T,
): { data: T | undefined; isLoading: boolean; error: unknown } {
  const { run, sourceKey } = useFacetSource();
  const { data: bindings, isLoading, error } = useQuery({
    queryKey: ["facet-query", sourceKey, query],
    queryFn: async () => {
      try {
        return await run(query!);
      } catch (cause) {
        console.warn("[shacl-everything] facet query failed:", cause);
        throw cause;
      }
    },
    enabled: query !== undefined,
    placeholderData: keepPreviousData,
    ...noRefetch,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => (bindings ? parse(bindings) : undefined), [bindings]);
  // A disabled query's placeholder would otherwise keep showing the last enabled result.
  return query === undefined
    ? { data: undefined, isLoading: false, error: undefined }
    : { data, isLoading, error };
}

/** What a facet widget's data hooks are about: one property's path, or explicit overrides. */
export type FacetPropertyData = {
  // toSparql() of the property's path; undefined for a property with no sh:path.
  pathSparql: string | undefined;
  // Replaces the queried values/counts outright - TypeSelector's synthetic rdf:type facet, whose
  // options are the root shapes' classes and whose counts are per-root-shape target counts.
  overrides?: { values?: Term[]; valueCounts?: Map<string, number> };
};

const FacetPropertyDataContext = createContext<FacetPropertyData | undefined>(undefined);

export function FacetPropertyDataProvider({
  value,
  children,
}: {
  value: FacetPropertyData;
  children: ReactNode;
}) {
  return <FacetPropertyDataContext.Provider value={value}>{children}</FacetPropertyDataContext.Provider>;
}

function useFacetPropertyData(): FacetPropertyData {
  const value = useContext(FacetPropertyDataContext);
  if (!value) throw new Error("facet data hooks must be used inside a facet widget");
  return value;
}

/**
 * This facet's option values: the most common values on its path across every target instance
 * (capped at FACET_VALUE_LIMIT, most common first), deliberately *not* narrowed by any filter - an
 * option other facets currently rule out still shows (with a zero count), it doesn't vanish.
 */
export function useFacetValues(): { values: Term[]; isLoading: boolean; error: unknown } {
  const { pathSparql, overrides } = useFacetPropertyData();
  const { targets } = useFacetSource();
  const query =
    overrides?.values === undefined && pathSparql !== undefined
      ? valueCountsQuery(pathSparql, { targets, filter: "" })
      : undefined;
  const { data, isLoading, error } = useFacetQueryResult(query, parseValueCounts);
  const values = useMemo(
    () => overrides?.values ?? (data ?? []).map(({ value }) => value),
    [overrides?.values, data],
  );
  return { values, isLoading, error };
}

/**
 * Per-value instance counts (keyed by termKey) given every *other* facet's constraints - only when
 * Environment.enableFacetOptionCounts is on, undefined otherwise. This facet's own constraint is
 * left out, so multi-selecting within one facet (an OR) doesn't shrink its own options' counts.
 */
export function useFacetValueCounts(): Map<string, number> | undefined {
  const { pathSparql, overrides } = useFacetPropertyData();
  const { targets, countsEnabled } = useFacetSource();
  const filter = useCompiledFilter(pathSparql);
  const query =
    countsEnabled && overrides?.valueCounts === undefined && pathSparql !== undefined
      ? valueCountsQuery(pathSparql, { targets, filter })
      : undefined;
  const { data } = useFacetQueryResult(query, (bindings) => toCountMap(parseValueCounts(bindings)));
  return overrides?.valueCounts ?? (countsEnabled ? data : undefined);
}

/** The smallest/largest value on this facet's path, across every target instance. */
export function useFacetValueBounds(): ValueBounds {
  const { pathSparql } = useFacetPropertyData();
  const { targets } = useFacetSource();
  const query =
    pathSparql !== undefined ? valueBoundsQuery(pathSparql, { targets, filter: "" }) : undefined;
  return useFacetQueryResult(query, parseValueBounds).data ?? {};
}

/**
 * Which color buckets (helpers/colorBuckets.ts) this facet's values fall into at all, and - when
 * counts are on - how many instances per bucket given every other facet's constraints.
 */
export function useFacetColorBuckets(): {
  available: ColorBucket[];
  counts: Map<ColorBucket, number> | undefined;
} {
  const { pathSparql } = useFacetPropertyData();
  const { targets, countsEnabled } = useFacetSource();
  const filter = useCompiledFilter(pathSparql);
  const availableQuery =
    pathSparql !== undefined ? colorBucketCountsQuery(pathSparql, { targets, filter: "" }) : undefined;
  const countsQuery =
    countsEnabled && pathSparql !== undefined
      ? colorBucketCountsQuery(pathSparql, { targets, filter })
      : undefined;
  const available = useFacetQueryResult(availableQuery, parseColorBucketCounts).data;
  const counts = useFacetQueryResult(countsQuery, parseColorBucketCounts).data;
  return {
    available: useMemo(() => [...(available?.keys() ?? [])], [available]),
    counts: countsEnabled ? counts : undefined,
  };
}

/** How many instances satisfy every constraint (this facet's own included), or undefined. */
export function useFacetMatchCount(enabled: boolean): number | undefined {
  const { targets, countsEnabled } = useFacetSource();
  const filter = useCompiledFilter();
  const query = enabled && countsEnabled ? matchCountQuery({ targets, filter }) : undefined;
  return useFacetQueryResult(query, parseMatchCount).data;
}
