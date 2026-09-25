import { describe, expect, test } from "vite-plus/test";
import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { ex, queryPrefixes, sh, st, xsd } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import type { QuerySource } from "@/helpers/queryEngine.ts";
import { termKey } from "@/helpers/termKey.ts";
import { compileFilter, compileTargets } from "@/facets/compileFilter.ts";
import {
  colorBucketCountsQuery,
  facetQueryRunner,
  keyedCountsQuery,
  matchCountQuery,
  matchingInstancesQuery,
  parseColorBucketCounts,
  parseInstances,
  parseKeyedCounts,
  parseMatchCount,
  parseValueBounds,
  parseValueCounts,
  toCountMap,
  valueBoundsQuery,
  valueCountsQuery,
} from "@/facets/facetQueries.ts";
import { createFilterShape, setFilterConstraintForProperty } from "@/facets/filterShape.ts";
import { sparqlEndpointFetch } from "@/facets/testing/sparqlEndpointShim.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

const SHAPES = `${queryPrefixes}
ex:ProductShape a sh:NodeShape ; sh:targetClass ex:Product ;
  sh:property ex:categoryProperty, ex:priceProperty, ex:colorProperty .
ex:categoryProperty sh:path ex:category .
ex:priceProperty sh:path ex:price .
ex:colorProperty sh:path ex:color .
ex:Gadget rdfs:subClassOf ex:Product .
ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .
`;

const DATA = `${queryPrefixes}
ex:laptop a ex:Product ; ex:category ex:Electronics, ex:Office ; ex:price 900 ; ex:color ex:red .
ex:phone a ex:Gadget ; ex:category ex:Electronics ; ex:price 500 ; ex:color ex:blue .
ex:desk a ex:Product ; ex:category ex:Office ; ex:price 200 .
ex:novel a ex:Product ; ex:price 15 .
ex:alice a ex:Person ; ex:category ex:Electronics .
ex:red st:hue 0 ; st:saturation 90 ; st:lightness 50 .
ex:blue st:hue 230 ; st:saturation 90 ; st:lightness 50 .
`;

async function fixture() {
  const shapesGraph = await parseRdf(SHAPES, "text/turtle");
  const dataGraph = await parseRdf(DATA, "text/turtle");
  const property = (name: string) =>
    new PropertyUIElement({
      widgetRegistry: defaultWidgets,
      shapesGraph,
      dataGraph,
      focusNode: ex("unused"),
      propertyShapes: [ex(name)],
    });
  return { shapesGraph, dataGraph, property };
}

// Every query runs both against the local store and through the SPARQL endpoint shim serving the
// same store - Environment.facetsEndpoint's exact code path.
const sources = [
  ["local", (dataGraph: RdfStore) => ({ source: { kind: "local", store: dataGraph } as QuerySource })],
  [
    "endpoint",
    (dataGraph: RdfStore) => {
      const fetch = sparqlEndpointFetch(dataGraph);
      return {
        source: { kind: "endpoint", url: "http://endpoint.test/sparql" } as QuerySource,
        fetch,
      };
    },
  ],
] as const;

describe.each(sources)("facet queries (%s)", (kind, makeSource) => {
  async function setup() {
    const { shapesGraph, dataGraph, property } = await fixture();
    const { source, fetch } = makeSource(dataGraph) as { source: QuerySource; fetch?: typeof globalThis.fetch & { requests: string[] } };
    const run = facetQueryRunner(source, { fetch });
    const classGraphs = kind === "local" ? [shapesGraph, dataGraph] : [shapesGraph];
    const targets = compileTargets([ex("ProductShape") as Quad_Subject], shapesGraph, { classGraphs });
    const filterShape = createFilterShape();
    return { shapesGraph, dataGraph, property, run, classGraphs, targets, filterShape, fetch };
  }

  test("targets include instances of subclasses (ex:Gadget ⊑ ex:Product)", async () => {
    const { run, targets } = await setup();
    const instances = parseInstances(await run(matchingInstancesQuery({ targets, filter: "" })));
    expect(instances.map((term) => term.value).sort()).toEqual(
      [ex("desk"), ex("laptop"), ex("novel"), ex("phone")].map((term) => term.value).sort(),
    );
  });

  test("value counts count distinct instances per value, most common first", async () => {
    const { run, targets } = await setup();
    const counts = parseValueCounts(await run(valueCountsQuery(`<${ex("category").value}>`, { targets, filter: "" })));
    expect(counts.map(({ value, count }) => [value.value, count])).toEqual([
      [ex("Electronics").value, 2],
      [ex("Office").value, 2],
    ].sort((a, b) => (b[1] as number) - (a[1] as number)));
    // ex:alice (a Person, not a target) holds Electronics too but isn't counted.
  });

  test("another facet's constraint narrows the counts; the facet's own constraint doesn't", async () => {
    const { run, targets, filterShape, property, classGraphs } = await setup();
    setFilterConstraintForProperty(filterShape, property("categoryProperty"), sh("in"), [ex("Office")]);
    setFilterConstraintForProperty(
      filterShape,
      property("priceProperty"),
      sh("maxInclusive"),
      factory.literal("500", xsd("integer")),
    );

    // Category counts, narrowed by price only: phone (500) and desk (200) remain.
    const categoryFilter = compileFilter(filterShape, { classGraphs, excludePath: `<${ex("category").value}>` });
    const categoryCounts = toCountMap(
      parseValueCounts(await run(valueCountsQuery(`<${ex("category").value}>`, { targets, filter: categoryFilter }))),
    );
    expect(categoryCounts.get(termKey(ex("Electronics")))).toBe(1);
    expect(categoryCounts.get(termKey(ex("Office")))).toBe(1);

    // Everything applied: only desk is Office and ≤ 500.
    const all = compileFilter(filterShape, { classGraphs });
    expect(parseMatchCount(await run(matchCountQuery({ targets, filter: all })))).toBe(1);
  });

  test("value bounds are computed by the source", async () => {
    const { run, targets } = await setup();
    const bounds = parseValueBounds(await run(valueBoundsQuery(`<${ex("price").value}>`, { targets, filter: "" })));
    expect([bounds.min?.value, bounds.max?.value]).toEqual(["15", "900"]);
  });

  test("color buckets are classified by the source, and a bucket pick filters the same way", async () => {
    const { run, targets, filterShape, property, classGraphs } = await setup();
    const colorPath = `<${ex("color").value}>`;
    const buckets = parseColorBucketCounts(await run(colorBucketCountsQuery(colorPath, { targets, filter: "" })));
    expect(Object.fromEntries(buckets)).toEqual({ red: 1, blue: 1 });

    setFilterConstraintForProperty(filterShape, property("colorProperty"), st("colorBucket"), factory.literal("blue"));
    const filter = compileFilter(filterShape, { classGraphs });
    const matching = parseInstances(await run(matchingInstancesQuery({ targets, filter })));
    expect(matching.map((term) => term.value)).toEqual([ex("phone").value]);
  });

  test("keyed counts give each root shape's own target count in one query", async () => {
    const { run, shapesGraph, classGraphs } = await setup();
    const query = keyedCountsQuery(
      ["ProductShape", "PersonShape"].map((name) => ({
        key: `<${ex(name).value}>`,
        targets: compileTargets([ex(name) as Quad_Subject], shapesGraph, { classGraphs }),
      })),
    );
    const counts = parseKeyedCounts(await run(query));
    expect(counts.get(termKey(ex("ProductShape")))).toBe(4);
    expect(counts.get(termKey(ex("PersonShape")))).toBe(1);
  });

  if (kind === "endpoint") {
    test("each facet query is shipped to the endpoint whole, as a single request", async () => {
      const { run, targets, filterShape, property, classGraphs, fetch } = await setup();
      setFilterConstraintForProperty(filterShape, property("categoryProperty"), sh("in"), [ex("Office")]);
      const filter = compileFilter(filterShape, { classGraphs });
      await run(matchCountQuery({ targets, filter }));
      fetch!.requests.length = 0;

      await run(valueCountsQuery(`<${ex("price").value}>`, { targets, filter }));
      expect(fetch!.requests).toHaveLength(1);
      expect(fetch!.requests[0]).toMatch(/COUNT\(DISTINCT \?this\)/);
      expect(fetch!.requests[0]).toMatch(/GROUP BY/);
    });
  }
});
