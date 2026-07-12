import { expect, test } from "vite-plus/test";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { removePropertyPath } from "@/structure/paths/removePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";

async function remove(
  shapeTurtle: string,
  dataTurtle: string,
  shapeName: string,
  value: Parameters<typeof removePropertyPath>[3],
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

  removePropertyPath(path, focusNode, dataGraph, value);
  return walkPropertyPath(path, focusNode, dataGraph).map((term) => term.value);
}

test("removePropertyPath - predicate path removes the matching value", async () => {
  const values = await remove(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:name "Alice" .`,
    "nameShape",
    factory.literal("Alice"),
  );
  expect(values).toEqual([]);
});

test("removePropertyPath - predicate path leaves other values untouched", async () => {
  const values = await remove(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:name "Alice", "Ally" .`,
    "nameShape",
    factory.literal("Alice"),
  );
  expect(values).toEqual(["Ally"]);
});

test("removePropertyPath - does nothing when the value isn't reachable through the path", async () => {
  const values = await remove(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:name "Alice" .`,
    "nameShape",
    factory.literal("NotThere"),
  );
  expect(values).toEqual(["Alice"]);
});

test("removePropertyPath - sequence path removes the value at the end of the chain", async () => {
  const values = await remove(
    `ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .`,
    `ex:Alice ex:spouse ex:Bob . ex:Bob ex:father ex:Charlie .`,
    "spouseFatherShape",
    ex("Charlie"),
  );
  expect(values).toEqual([]);
});

test("removePropertyPath - sequence path does nothing when an intermediate step is missing", async () => {
  const values = await remove(
    `ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .`,
    ``,
    "spouseFatherShape",
    ex("Charlie"),
  );
  expect(values).toEqual([]);
});

test("removePropertyPath - inverse path removes the underlying predicate quad", async () => {
  const values = await remove(
    `ex:childShape a sh:PropertyShape ; sh:path [ sh:inversePath ex:parent ] .`,
    `ex:Bob ex:parent ex:Alice .`,
    "childShape",
    ex("Bob"),
  );
  expect(values).toEqual([]);
});

test("removePropertyPath - alternative path throws", async () => {
  await expect(
    remove(
      `ex:parentShape a sh:PropertyShape ; sh:path [ sh:alternativePath ( ex:father ex:mother ) ] .`,
      `ex:Alice ex:father ex:Dan .`,
      "parentShape",
      ex("Dan"),
    ),
  ).rejects.toThrow(/Cannot remove a value through a alternative path/);
});

test("removePropertyPath - zeroOrMore path throws", async () => {
  await expect(
    remove(
      `ex:ancestorShape a sh:PropertyShape ; sh:path [ sh:zeroOrMorePath ex:parent ] .`,
      `ex:Alice ex:parent ex:Bob .`,
      "ancestorShape",
      ex("Bob"),
    ),
  ).rejects.toThrow(/Cannot remove a value through a zeroOrMore path/);
});
