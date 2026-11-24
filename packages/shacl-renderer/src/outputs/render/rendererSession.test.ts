import { expect, test } from "vite-plus/test";
import { QueryClient } from "@tanstack/react-query";
import { RdfStore } from "rdf-stores";
import { defaultEnvironment, type Environment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";
import { runPreprocessors } from "@/preprocess/index.ts";
import { continueSession } from "@/outputs/render/rendererSession.ts";

// A shape with blank-node property shapes, and a missingPropertiesGroup so preprocessing generates
// more of them from the focus node's own predicates.
const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix st: <http://shapething.com/> .
  @prefix ex: <http://example.org/> .
  ex:ThingShape a sh:NodeShape ;
    st:missingPropertiesGroup ex:rest ;
    sh:property [ sh:path ex:name ; sh:datatype <http://www.w3.org/2001/XMLSchema#string> ] .
`;

const dataGraph = RdfStore.createDefault();
// Untyped, so no class leads to a shape: only the focus node's own predicates generate any.
for (const node of [ex("a"), ex("b")]) {
  dataGraph.addQuad(factory.quad(node, ex("name"), factory.literal(node.value)));
  dataGraph.addQuad(factory.quad(node, ex("extra"), factory.literal("x")));
}
dataGraph.addQuad(factory.quad(ex("b"), ex("onlyOnB"), factory.literal("y")));

const preprocess = (focusNode: typeof ex.a) =>
  runPreprocessors({
    ...defaultEnvironment,
    mode: "view",
    shapesGraph,
    dataGraph,
    focusNode,
    nodeShapes: [ex("ThingShape")],
    enableMissingShapesGeneration: true,
  });

const quadCount = (environment: Environment) => environment.shapesGraph.size;

test("continueSession - the same shapes and data preprocessed twice carry over the stores and the cache", async () => {
  const previousClient = new QueryClient();
  const first = continueSession(previousClient, undefined, await preprocess(ex("a")));
  previousClient.setQueryData(["widget", "view", ["shape"], "value"], "picked");
  previousClient.setQueryData(["preprocess-environment", "id", 0], first);

  const queryClient = new QueryClient();
  const second = continueSession(queryClient, previousClient, await preprocess(ex("a")));

  expect(second.shapesGraph).toBe(first.shapesGraph);
  expect(second.dataGraph).toBe(first.dataGraph);
  expect(queryClient.getQueryData(["widget", "view", ["shape"], "value"])).toBe("picked");
  // The Environment itself belongs to the previous focusNode.
  expect(queryClient.getQueryData(["preprocess-environment", "id", 0])).toBeUndefined();
});

test("continueSession - shapes generated differently for another focusNode carry over nothing", async () => {
  const previousClient = new QueryClient();
  const first = continueSession(previousClient, undefined, await preprocess(ex("a")));
  previousClient.setQueryData(["widget", "view", ["shape"], "value"], "picked");

  const queryClient = new QueryClient();
  const fresh = await preprocess(ex("b"));
  const second = continueSession(queryClient, previousClient, fresh);

  // ex:onlyOnB got a generated property shape of its own.
  expect(quadCount(fresh)).toBeGreaterThan(quadCount(first));
  expect(second).toBe(fresh);
  expect(queryClient.getQueryData(["widget", "view", ["shape"], "value"])).toBeUndefined();
});

test("continueSession - without a previous client, the environment is used as is", async () => {
  const environment = await preprocess(ex("a"));
  expect(continueSession(new QueryClient(), undefined, environment)).toBe(environment);
});
