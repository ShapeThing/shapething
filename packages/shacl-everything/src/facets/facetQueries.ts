import type { Bindings, Term } from "@rdfjs/types";
import { COLOR_BUCKET_ORDER, sparqlFilterForBucket, type ColorBucket } from "@/helpers/colorBuckets.ts";
import { queryPrefixes, st } from "@/helpers/namespaces.ts";
import { selectBindings, type QueryOptions, type QuerySource } from "@/helpers/queryEngine.ts";
import { termKey } from "@/helpers/termKey.ts";
import { termToSparql } from "@/helpers/sparqlLiteral.ts";
import type { RdfStore } from "rdf-stores";
import { compileFilter, prefixBucketVariables } from "@/facets/compileFilter.ts";
import type { FilterShape } from "@/facets/filterShape.ts";

/**
 * The SPARQL queries behind every facet: option values, per-option counts, a single match count,
 * range bounds, color buckets and the matching instances themselves. Each builder takes already
 * compiled pattern text (facets/compileFilter.ts's compileTargets/compileFilter) and returns plain
 * query text; runFacetQuery runs it against the facet source - the local dataGraph or
 * Environment.facetsEndpoint, the same query either way. Callers (see
 * outputs/render/modes/facet/facetData.tsx) key their caches on the query text itself, so two
 * facets asking the identical question share one request.
 *
 * Counts are always COUNT(DISTINCT ?this) - "how many things", never "how many triples" - so an
 * instance holding a value twice, or matching through two alternative-path branches, counts once.
 */

// How many distinct values a single facet ever asks for. On a large endpoint a property can have
// millions of distinct values; a facet shows the most common ones (ordered by instance count).
export const FACET_VALUE_LIMIT = 1000;

export type FacetPatterns = {
  // compileTargets() output: which instances are in play at all.
  targets: string;
  // compileFilter() output: the currently active constraints to narrow by ("" for none).
  filter: string;
};

function where({ targets, filter }: FacetPatterns, extra = ""): string {
  return `{\n${targets}\n${filter}\n${extra}\n}`;
}

/**
 * `path`'s most common values across `patterns`' instances, each with how many instances hold it
 * - ordered by that count, capped at FACET_VALUE_LIMIT. With an empty filter this is a facet's
 * stable option list; with other facets' constraints as the filter it's that option list's live
 * counts.
 */
export function valueCountsQuery(pathSparql: string, patterns: FacetPatterns): string {
  return `${queryPrefixes}
SELECT ?value (COUNT(DISTINCT ?this) AS ?count) WHERE ${where(patterns, `?this ${pathSparql} ?value .`)}
GROUP BY ?value
ORDER BY DESC(?count)
LIMIT ${FACET_VALUE_LIMIT}`;
}

/** How many instances satisfy `patterns` - a range/search/map facet's single match count. */
export function matchCountQuery(patterns: FacetPatterns): string {
  return `${queryPrefixes}
SELECT (COUNT(DISTINCT ?this) AS ?count) WHERE ${where(patterns)}`;
}

/** The smallest and largest value on `path` - a range facet's bounds, computed by the source. */
export function valueBoundsQuery(pathSparql: string, patterns: FacetPatterns): string {
  return `${queryPrefixes}
SELECT (MIN(?value) AS ?min) (MAX(?value) AS ?max) WHERE ${where(patterns, `?this ${pathSparql} ?value .`)}`;
}

/**
 * How many instances have a color value (st:hue/st:saturation/st:lightness - see
 * helpers/colorBuckets.ts) in each named bucket, classified by the source itself via the same
 * sparqlFilterForBucket text an st:colorBucket constraint compiles to - so the swatches a
 * ColorFacet shows and what picking one actually filters can never disagree. Grouped by bucket
 * name, never by the color node itself: color values are typically blank nodes, whose labels
 * aren't stable across two queries to an endpoint.
 */
export function colorBucketCountsQuery(pathSparql: string, patterns: FacetPatterns): string {
  // sparqlFilterForBucket's conditions are mutually exclusive, so one IF chain names each value's
  // bucket (a UNION of per-bucket branches couldn't: a FILTER inside a branch doesn't see ?colorhue).
  const bucketExpression = COLOR_BUCKET_ORDER.reduceRight(
    (otherwise, bucket) =>
      `IF(${prefixBucketVariables(sparqlFilterForBucket(bucket), "color")}, "${bucket}", ${otherwise})`,
    `""`,
  );
  return `${queryPrefixes}
SELECT ?bucket (COUNT(DISTINCT ?this) AS ?count) WHERE ${where(
    patterns,
    `?this ${pathSparql} ?colorValue .
?colorValue <${st("hue").value}> ?colorhue ; <${st("saturation").value}> ?colorsat ; <${st("lightness").value}> ?colorlight .
BIND(${bucketExpression} AS ?bucket)
FILTER(?bucket != "")`,
  )}
GROUP BY ?bucket`;
}

/**
 * The instances satisfying `patterns`, optionally restricted to `candidates` (e.g.
 * FacetSearchModal's own universe of pickable instances).
 */
export function matchingInstancesQuery(
  patterns: FacetPatterns,
  candidates?: Term[],
  limit?: number,
): string {
  const values =
    candidates &&
    `VALUES ?this { ${candidates
      .map(termToSparql)
      .filter((term): term is string => term !== undefined)
      .join(" ")} }`;
  return `${queryPrefixes}
SELECT DISTINCT ?this WHERE ${where(patterns, values ?? "")}${limit !== undefined ? `\nLIMIT ${limit}` : ""}`;
}

/**
 * How many instances each of several target patterns covers, in one query - TypeSelector's
 * per-root-shape counts. Each branch binds its own `key` (a SPARQL term, e.g. the root shape's
 * class) as ?key; parseKeyedCounts maps the result back by termKey.
 */
export function keyedCountsQuery(branches: { key: string; targets: string }[]): string {
  return `${queryPrefixes}
SELECT ?key (COUNT(DISTINCT ?this) AS ?count) WHERE {
${branches.map(({ key, targets }) => `{ ${targets} BIND(${key} AS ?key) }`).join(" UNION ")}
}
GROUP BY ?key`;
}

export function parseKeyedCounts(bindings: Bindings[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const binding of bindings) {
    const key = binding.get("key");
    if (key) counts.set(termKey(key), countOf(binding.get("count")));
  }
  return counts;
}

export type FacetQueryRunner = (query: string) => Promise<Bindings[]>;

export function facetQueryRunner(source: QuerySource, options: QueryOptions = {}): FacetQueryRunner {
  return (query) => selectBindings(query, source, options);
}

function countOf(term: Term | undefined): number {
  const parsed = term ? Number.parseInt(term.value, 10) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export type ValueCount = { value: Term; count: number };

export function parseValueCounts(bindings: Bindings[]): ValueCount[] {
  return bindings.flatMap((binding) => {
    const value = binding.get("value");
    return value ? [{ value, count: countOf(binding.get("count")) }] : [];
  });
}

export function toCountMap(valueCounts: ValueCount[]): Map<string, number> {
  return new Map(valueCounts.map(({ value, count }) => [termKey(value), count]));
}

export function parseMatchCount(bindings: Bindings[]): number {
  return countOf(bindings[0]?.get("count"));
}

export type ValueBounds = { min?: Term; max?: Term };

export function parseValueBounds(bindings: Bindings[]): ValueBounds {
  return { min: bindings[0]?.get("min"), max: bindings[0]?.get("max") };
}

export function parseColorBucketCounts(bindings: Bindings[]): Map<ColorBucket, number> {
  const counts = new Map<ColorBucket, number>();
  for (const binding of bindings) {
    const bucket = binding.get("bucket")?.value as ColorBucket | undefined;
    if (bucket) counts.set(bucket, countOf(binding.get("count")));
  }
  return counts;
}

export function parseInstances(bindings: Bindings[]): Term[] {
  return bindings.flatMap((binding) => {
    const instance = binding.get("this");
    return instance ? [instance] : [];
  });
}

/**
 * The subset of `candidates` satisfying every constraint on `filterShape` - for a caller that
 * already holds its own bounded universe of instances (FacetSearchModal's pickable values) and just
 * needs facet mode's generated shape applied to it, rather than a facet's own targets.
 */
export async function instancesMatchingFilterShape(
  filterShape: FilterShape,
  candidates: Term[],
  {
    source,
    shapesGraph,
    queryOptions,
  }: { source: QuerySource; shapesGraph: RdfStore; queryOptions?: QueryOptions },
): Promise<Term[]> {
  if (candidates.length === 0) return [];
  const filter = compileFilter(filterShape, {
    classGraphs: source.kind === "local" ? [shapesGraph, source.store] : [shapesGraph],
  });
  if (filter === "") return candidates;
  const matching = new Set(
    parseInstances(
      await selectBindings(matchingInstancesQuery({ targets: "", filter }, candidates), source, queryOptions),
    ).map(termKey),
  );
  return candidates.filter((candidate) => matching.has(termKey(candidate)));
}
