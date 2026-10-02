import { expect, test } from "vite-plus/test";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import {
  branchHoldingValue,
  defaultWriteBranch,
  switchableAlternativeBranches,
} from "@/structure/paths/alternativePathBranches.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";

async function parseShapePath(turtle: string, shapeName: string) {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");
  const path = parsePropertyPath(ex(shapeName), shapesGraph);
  if (!path) throw new Error(`No sh:path found on ${shapeName}`);
  return path;
}

test("switchableAlternativeBranches - returns the branch predicates, in declaration order, for a plain alternative path", async () => {
  const path = await parseShapePath(
    `ex:titleShape a sh:PropertyShape ; sh:path [ sh:alternativePath (ex:title ex:label) ] .`,
    "titleShape",
  );
  expect(switchableAlternativeBranches(path)?.map((term) => term.value)).toEqual([
    ex("title").value,
    ex("label").value,
  ]);
});

test("switchableAlternativeBranches - undefined for a plain predicate path", async () => {
  const path = await parseShapePath(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    "nameShape",
  );
  expect(switchableAlternativeBranches(path)).toBeUndefined();
});

test("switchableAlternativeBranches - undefined when a branch is itself a sequence", async () => {
  const path = await parseShapePath(
    `ex:byMotherOrFatherShape a sh:PropertyShape ;
       sh:path [ sh:alternativePath ( (ex:mother ex:name) (ex:father ex:name) ) ] .`,
    "byMotherOrFatherShape",
  );
  expect(switchableAlternativeBranches(path)).toBeUndefined();
});

test("switchableAlternativeBranches - undefined when a branch is an inverse path", async () => {
  const path = await parseShapePath(
    `ex:relatedShape a sh:PropertyShape ;
       sh:path [ sh:alternativePath ( ex:father [ sh:inversePath ex:child ] ) ] .`,
    "relatedShape",
  );
  expect(switchableAlternativeBranches(path)).toBeUndefined();
});

test("branchHoldingValue - finds the branch that currently holds the value", async () => {
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:Alice ex:label "Alicia" .`,
    "text/turtle",
  );
  const found = branchHoldingValue(
    [ex("title"), ex("label")],
    ex("Alice"),
    dataGraph,
    dataGraph.getQuads(ex("Alice"), ex("label"))[0].object,
  );
  expect(found?.value).toBe(ex("label").value);
});

test("branchHoldingValue - undefined when the value isn't reachable through any branch", async () => {
  const dataGraph = await parseRdf("", "text/turtle");
  const found = branchHoldingValue(
    [ex("title"), ex("label")],
    ex("Alice"),
    dataGraph,
    factory.literal("Alicia"),
  );
  expect(found).toBeUndefined();
});

test("defaultWriteBranch - prefers a branch that already has any existing value", async () => {
  const dataGraph = await parseRdf(
    `${queryPrefixes}\n\n ex:Alice ex:label "Alicia" .`,
    "text/turtle",
  );
  const branch = defaultWriteBranch([ex("title"), ex("label")], ex("Alice"), dataGraph);
  expect(branch.value).toBe(ex("label").value);
});

test("defaultWriteBranch - falls back to the first declared branch when neither has data", async () => {
  const dataGraph = await parseRdf("", "text/turtle");
  const branch = defaultWriteBranch([ex("title"), ex("label")], ex("Alice"), dataGraph);
  expect(branch.value).toBe(ex("title").value);
});
