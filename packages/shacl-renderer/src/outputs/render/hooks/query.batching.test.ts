import { beforeEach, expect, test, vi } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { fetchOptions, runQuery } from "./query.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

// fetchOptions coalesces concurrent calls that would otherwise run an identical query (see
// query.ts's batchRoleLookup/roleLookupBatchKey) - this file exists solely to verify a call with a
// different `endpoint` never joins another call's batch, by intercepting the actual query text
// (and `sparql` endpoint source) Comunica receives instead of letting it really try to reach a fake
// endpoint over the network. Kept out of query.test.ts, which relies on the real Comunica engine throughout -
// mocking it here would break those tests too, since Vitest applies a file's own `vi.mock` calls
// to that file's whole module graph.
const recordedQueries: { query: string; endpoint?: string }[] = [];

vi.mock("@comunica/query-sparql", () => {
  class FakeQueryEngine {
    async query(query: string, context: { sources: Array<{ type?: string; value?: unknown }> }) {
      const endpoint = context.sources.find((source) => source.type === "sparql")?.value;
      recordedQueries.push({
        query,
        endpoint: typeof endpoint === "string" ? endpoint : undefined,
      });
      return {
        resultType: "bindings",
        metadata: async () => ({ variables: [] }),
        execute: async () => ({ toArray: async () => [] }),
      };
    }
  }
  return { QueryEngine: FakeQueryEngine };
});

const createShape = async (shapesTurtle: string, dataTurtle: string) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    widgetRegistry: defaultWidgets,
    shapesGraph,
    dataGraph,
    focusNode: ex("Subject"),
    propertyShapes: [ex("property1")],
  });
};

beforeEach(() => {
  recordedQueries.length = 0;
});

test("fetchOptions() never merges calls for different federated endpoints into one query", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Person ; sh:node ex:PersonShape .
      ex:PersonShape sh:property ex:nameProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
    `,
    ``,
  );

  // Same shape (same role paths, same dataGraph) - only the endpoint differs - so this is exactly
  // the case that would wrongly merge if roleLookupBatchKey ever forgot to include `endpoint`.
  await Promise.all([
    fetchOptions(shape, [ex("p1")], { endpoint: "https://endpoint-a.example/sparql" }),
    fetchOptions(shape, [ex("p2")], { endpoint: "https://endpoint-b.example/sparql" }),
  ]);

  expect(recordedQueries).toHaveLength(2);

  const queryForA = recordedQueries.find(({ endpoint }) =>
    endpoint?.includes("endpoint-a.example"),
  )?.query;
  const queryForB = recordedQueries.find(({ endpoint }) =>
    endpoint?.includes("endpoint-b.example"),
  )?.query;

  expect(queryForA).toContain(`<${ex("p1").value}>`);
  expect(queryForA).not.toContain(`<${ex("p2").value}>`);
  expect(queryForB).toContain(`<${ex("p2").value}>`);
  expect(queryForB).not.toContain(`<${ex("p1").value}>`);
});

test("fetchOptions() still merges concurrent calls that share the same endpoint (and everything else)", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:class ex:Person ; sh:node ex:PersonShape .
      ex:PersonShape sh:property ex:nameProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
    `,
    ``,
  );

  await Promise.all([
    fetchOptions(shape, [ex("p1")], { endpoint: "https://endpoint-a.example/sparql" }),
    fetchOptions(shape, [ex("p2")], { endpoint: "https://endpoint-a.example/sparql" }),
  ]);

  expect(recordedQueries).toHaveLength(1);
  expect(recordedQueries[0].query).toContain(`<${ex("p1").value}>`);
  expect(recordedQueries[0].query).toContain(`<${ex("p2").value}>`);
});

// Regression: wrapped in SERVICE, Comunica 5 split the role lookup into one unbound request per
// OPTIONAL (e.g. every dbo:thumbnail on DBpedia) - it has to reach the endpoint as one query.
test("fetchOptions() sends a federated role lookup to the endpoint as a single query, not via SERVICE", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:node ex:PersonShape .
      ex:PersonShape sh:property ex:nameProperty, ex:pictureProperty .
      ex:nameProperty sh:path ex:name ; shui:propertyRole shui:LabelRole .
      ex:pictureProperty sh:path ex:picture ; shui:propertyRole shui:DepictionRole .
    `,
    ``,
  );

  await fetchOptions(shape, [ex("p1")], { endpoint: "https://endpoint-a.example/sparql" });

  expect(recordedQueries).toHaveLength(1);
  expect(recordedQueries[0].endpoint).toBe("https://endpoint-a.example/sparql");
  expect(recordedQueries[0].query).not.toMatch(/\bservice\b/i);
  expect(recordedQueries[0].query).toContain(`values ?value { <${ex("p1").value}> }`);
});

// Regression: the academic showcase's federated sh:in (FILTER NOT EXISTS inside a SERVICE block)
// made Comunica fire ~190 identical requests per validation, one per ?label binding.
test("runQuery() runs a query that is just one SERVICE block against that endpoint directly", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:path ex:p .`, ``);

  await runQuery(
    `SELECT ?value WHERE {
      SERVICE <https://endpoint-a.example/sparql> {
        ?value a ex:Country .
        FILTER NOT EXISTS { ?value ex:yearEnd ?end }
      }
    }`,
    shape,
  );

  expect(recordedQueries).toHaveLength(1);
  expect(recordedQueries[0].endpoint).toBe("https://endpoint-a.example/sparql");
  expect(recordedQueries[0].query).not.toMatch(/\bSERVICE\b/);
  expect(recordedQueries[0].query).toContain("FILTER NOT EXISTS { ?value ex:yearEnd ?end }");
});
