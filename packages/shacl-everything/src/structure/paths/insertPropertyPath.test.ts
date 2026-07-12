import { expect, test } from "vite-plus/test";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { insertPropertyPath } from "@/structure/paths/insertPropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";

async function insert(
  shapeTurtle: string,
  dataTurtle: string,
  shapeName: string,
  value: Parameters<typeof insertPropertyPath>[3],
  focusNode = ex("Alice"),
) {
  const prefixes = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
    `;
  const shapesGraph = await parseRdf(`${prefixes}\n${shapeTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${prefixes}\n${dataTurtle}`, "text/turtle");

  const path = parsePropertyPath(ex(shapeName), shapesGraph);
  if (!path) throw new Error(`No sh:path found on ${shapeName}`);

  insertPropertyPath(path, focusNode, dataGraph, value);
  return walkPropertyPath(path, focusNode, dataGraph).map((term) => term.value);
}

test("insertPropertyPath - predicate path adds a triple straight from the focus node", async () => {
  const values = await insert(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    ``,
    "nameShape",
    factory.literal("Alice"),
  );
  expect(values).toEqual(["Alice"]);
});

test("insertPropertyPath - predicate path keeps existing values alongside the new one", async () => {
  const values = await insert(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:name "Alice" .`,
    "nameShape",
    factory.literal("Ally"),
  );
  expect(values.sort()).toEqual(["Ally", "Alice"].sort());
});

test("insertPropertyPath - sequence path creates a fresh blank node for each missing intermediate step", async () => {
  const values = await insert(
    `ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .`,
    ``,
    "spouseFatherShape",
    ex("Charlie"),
  );
  expect(values).toEqual([ex("Charlie").value]);
});

test("insertPropertyPath - sequence path reuses an already reachable intermediate node", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf(
    `
        @prefix ex: <http://example.com/> .
        ex:Alice ex:spouse ex:Bob .
    `,
    "text/turtle",
  );

  const path = parsePropertyPath(ex("spouseFatherShape"), shapesGraph);
  if (!path) throw new Error("No sh:path found");

  insertPropertyPath(path, ex("Alice"), dataGraph, ex("Charlie"));

  expect(dataGraph.getQuads(ex("Alice"), ex("spouse")).map((quad) => quad.object.value)).toEqual([
    ex("Bob").value,
  ]);
  expect(walkPropertyPath(path, ex("Alice"), dataGraph).map((term) => term.value)).toEqual([
    ex("Charlie").value,
  ]);
});

test("insertPropertyPath - inverse path attaches the new value as the subject of the underlying predicate", async () => {
  const values = await insert(
    `ex:childShape a sh:PropertyShape ; sh:path [ sh:inversePath ex:parent ] .`,
    ``,
    "childShape",
    ex("Bob"),
  );
  expect(values).toEqual([ex("Bob").value]);
});

test("insertPropertyPath - inverse of a sequence reverses order and direction of each step", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .
        ex:inverseSequenceShape a sh:PropertyShape ; sh:path [ sh:inversePath ( ex:father ex:mother ) ] .
    `,
    "text/turtle",
  );
  const dataGraph = await parseRdf("", "text/turtle");

  const path = parsePropertyPath(ex("inverseSequenceShape"), shapesGraph);
  if (!path) throw new Error("No sh:path found");

  insertPropertyPath(path, ex("Alice"), dataGraph, ex("Bob"));

  // ^(father/mother) from Alice means: Bob -father-> X -mother-> Alice.
  const fatherQuads = dataGraph.getQuads(ex("Bob"), ex("father"));
  expect(fatherQuads.length).toBe(1);
  expect(dataGraph.getQuads(fatherQuads[0].object, ex("mother"), ex("Alice")).length).toBe(1);
});

test("insertPropertyPath - alternative path throws", async () => {
  await expect(
    insert(
      `ex:parentShape a sh:PropertyShape ; sh:path [ sh:alternativePath ( ex:father ex:mother ) ] .`,
      ``,
      "parentShape",
      ex("Dan"),
    ),
  ).rejects.toThrow(/Cannot insert a value through a alternative path/);
});

test("insertPropertyPath - zeroOrMore path throws", async () => {
  await expect(
    insert(
      `ex:ancestorShape a sh:PropertyShape ; sh:path [ sh:zeroOrMorePath ex:parent ] .`,
      ``,
      "ancestorShape",
      ex("Bob"),
    ),
  ).rejects.toThrow(/Cannot insert a value through a zeroOrMore path/);
});
