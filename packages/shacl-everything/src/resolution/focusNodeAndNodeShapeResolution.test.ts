import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { resolveFocusNodeAndNodeShapePairs } from "@/resolution/focusNodeAndNodeShapeResolution.ts";

async function graphs({ shapes, data }: { shapes?: string; data?: string }) {
  return {
    shapesGraph: await parseRdf(shapes ? `${queryPrefixes}\n\n${shapes}` : "", "text/turtle"),
    dataGraph: await parseRdf(data ? `${queryPrefixes}\n\n${data}` : "", "text/turtle"),
  };
}

function pairsAsValues(pairs: { focusNode: { value: string }; nodeShape: { value: string } }[]) {
  return pairs
    .map((pair) => [pair.focusNode.value, pair.nodeShape.value])
    .sort(([a1, a2], [b1, b2]) => a1.localeCompare(b1) || a2.localeCompare(b2));
}

test("step 1: both focus node and node shape given returns exactly that one pair", async () => {
  const { shapesGraph, dataGraph } = await graphs({});

  const pairs = resolveFocusNodeAndNodeShapePairs({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
    nodeShape: ex("PersonShape"),
  });

  expect(pairsAsValues(pairs)).toEqual([[ex("Alice").value, ex("PersonShape").value]]);
});

test("step 2: node shape given, focus node absent - one pair per target of that shape", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .`,
    data: `ex:Alice a ex:Person . ex:Bob a ex:Person . ex:NewYork a ex:Place .`,
  });

  const pairs = resolveFocusNodeAndNodeShapePairs({
    shapesGraph,
    dataGraph,
    nodeShape: ex("PersonShape"),
  });

  expect(pairsAsValues(pairs)).toEqual([
    [ex("Alice").value, ex("PersonShape").value],
    [ex("Bob").value, ex("PersonShape").value],
  ]);
});

test("step 3: focus node given, node shape absent - one pair per shape targeting it", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .
      ex:AgentShape a sh:NodeShape ; sh:targetClass ex:Agent .
    `,
    data: `ex:Alice a ex:Person, ex:Agent .`,
  });

  const pairs = resolveFocusNodeAndNodeShapePairs({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
  });

  expect(pairsAsValues(pairs)).toEqual([
    [ex("Alice").value, ex("AgentShape").value],
    [ex("Alice").value, ex("PersonShape").value],
  ]);
});

test("step 3: a deactivated shape targeting the focus node is excluded", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person ; sh:deactivated true .`,
    data: `ex:Alice a ex:Person .`,
  });

  const pairs = resolveFocusNodeAndNodeShapePairs({
    shapesGraph,
    dataGraph,
    focusNode: ex("Alice"),
  });

  expect(pairs).toEqual([]);
});

test("step 4: both absent - the targets of every non-deactivated node shape", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .
      ex:PlaceShape a sh:NodeShape ; sh:targetClass ex:Place ; sh:deactivated true .
    `,
    data: `ex:Alice a ex:Person . ex:NewYork a ex:Place .`,
  });

  const pairs = resolveFocusNodeAndNodeShapePairs({ shapesGraph, dataGraph });

  expect(pairsAsValues(pairs)).toEqual([[ex("Alice").value, ex("PersonShape").value]]);
});

test("step 4: several node shapes targeting the same focus node each produce their own pair", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .
      ex:AgentShape a sh:NodeShape ; sh:targetClass ex:Agent .
    `,
    data: `ex:Alice a ex:Person, ex:Agent .`,
  });

  const pairs = resolveFocusNodeAndNodeShapePairs({ shapesGraph, dataGraph });

  expect(pairsAsValues(pairs)).toEqual([
    [ex("Alice").value, ex("AgentShape").value],
    [ex("Alice").value, ex("PersonShape").value],
  ]);
});
