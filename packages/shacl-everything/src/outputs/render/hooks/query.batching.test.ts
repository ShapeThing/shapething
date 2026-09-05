import { beforeEach, expect, test, vi } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { fetchOptions } from "./query.ts";

// fetchOptions coalesces concurrent calls that would otherwise run an identical query (see
// query.ts's batchRoleLookup/roleLookupBatchKey) - this file exists solely to verify a call with a
// different `endpoint` never joins another call's batch, by intercepting the actual query text
// Comunica receives instead of letting a SERVICE clause really try to reach a fake endpoint over
// the network. Kept out of query.test.ts, which relies on the real Comunica engine throughout -
// mocking it here would break those tests too, since Vitest applies a file's own `vi.mock` calls
// to that file's whole module graph.
const recordedQueries: string[] = [];

vi.mock("@comunica/query-sparql", () => {
  class FakeQueryEngine {
    async queryBindings(query: string) {
      recordedQueries.push(query);
      return { toArray: async () => [] };
    }
  }
  return { QueryEngine: FakeQueryEngine };
});

const createShape = async (shapesTurtle: string, dataTurtle: string) => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
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

  const queryForA = recordedQueries.find((query) => query.includes("endpoint-a.example"));
  const queryForB = recordedQueries.find((query) => query.includes("endpoint-b.example"));

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
  expect(recordedQueries[0]).toContain(`<${ex("p1").value}>`);
  expect(recordedQueries[0]).toContain(`<${ex("p2").value}>`);
});
