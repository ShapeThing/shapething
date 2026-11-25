import { expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { sh } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { shapesTargetingNode, targetsOfShape } from "@/resolution/targets.ts";

// The definition shapesTargetingNode had before it was rewritten to check from the node's side:
// every candidate shape whose full target set (targetsOfShape) contains the node.
function reference(node: Term, shapesGraph: RdfStore, dataGraph: RdfStore): Quad_Subject[] {
  const candidates = dedupeTerms([
    ...shapesGraph.getQuads(null, sh("targetClass")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetNode")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetSubjectsOf")).map((quad) => quad.subject),
    ...shapesGraph.getQuads(null, sh("targetObjectsOf")).map((quad) => quad.subject),
    ...dataGraph.getQuads(null, sh("shape")).map((quad) => quad.object),
  ]) as Quad_Subject[];
  return candidates.filter((shape) =>
    targetsOfShape(shape, shapesGraph, dataGraph).some((target) => target.equals(node)),
  );
}

const root = path.join(import.meta.dirname, "../..");
const fixtures = fs
  .globSync("src/**/*.ttl", { cwd: root })
  .filter((file) => fs.statSync(path.join(root, file)).size < 400_000)
  .sort();

test("shapesTargetingNode matches the full-target-set definition on every fixture node", async () => {
  let checked = 0;
  for (const file of fixtures) {
    let graph: RdfStore;
    try {
      graph = await parseRdf(fs.readFileSync(path.join(root, file), "utf-8"), "text/turtle");
    } catch {
      continue;
    }
    if (
      graph.getQuads(null, sh("targetClass")).length === 0 &&
      graph.getQuads(null, sh("targetNode")).length === 0
    )
      continue;
    const nodes = dedupeTerms(graph.getQuads().flatMap((quad) => [quad.subject, quad.object]));
    for (const node of nodes.slice(0, 400)) {
      expect(shapesTargetingNode(node, graph, graph), `${file} ${node.value}`).toEqual(
        reference(node, graph, graph),
      );
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(1000);
});
