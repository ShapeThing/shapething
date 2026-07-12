import { expect, test } from "vite-plus/test";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { replacePropertyPath } from "@/structure/paths/replacePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";

async function replace(
  shapeTurtle: string,
  dataTurtle: string,
  shapeName: string,
  oldValue: Parameters<typeof replacePropertyPath>[3],
  newValue: Parameters<typeof replacePropertyPath>[4],
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

  replacePropertyPath(path, focusNode, dataGraph, oldValue, newValue);
  return walkPropertyPath(path, focusNode, dataGraph).map((term) => term.value);
}

test("replacePropertyPath - predicate path swaps the matching value in place", async () => {
  const values = await replace(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:name "Alice" .`,
    "nameShape",
    factory.literal("Alice"),
    factory.literal("Alicia"),
  );
  expect(values).toEqual(["Alicia"]);
});

test("replacePropertyPath - predicate path leaves other values untouched", async () => {
  const values = await replace(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:name "Alice", "Ally" .`,
    "nameShape",
    factory.literal("Alice"),
    factory.literal("Alicia"),
  );
  expect(values.sort()).toEqual(["Alicia", "Ally"].sort());
});

test("replacePropertyPath - does nothing when the old value isn't reachable through the path", async () => {
  const values = await replace(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:name "Alice" .`,
    "nameShape",
    factory.literal("NotThere"),
    factory.literal("Alicia"),
  );
  expect(values).toEqual(["Alice"]);
});

test("replacePropertyPath - sequence path swaps the value at the end of the chain", async () => {
  const values = await replace(
    `ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .`,
    `ex:Alice ex:spouse ex:Bob . ex:Bob ex:father ex:Charlie .`,
    "spouseFatherShape",
    ex("Charlie"),
    ex("Dave"),
  );
  expect(values).toEqual([ex("Dave").value]);
});

test("replacePropertyPath - sequence path does nothing when an intermediate step is missing", async () => {
  const values = await replace(
    `ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .`,
    ``,
    "spouseFatherShape",
    ex("Charlie"),
    ex("Dave"),
  );
  expect(values).toEqual([]);
});

test("replacePropertyPath - inverse path swaps the subject of the underlying predicate", async () => {
  const values = await replace(
    `ex:childShape a sh:PropertyShape ; sh:path [ sh:inversePath ex:parent ] .`,
    `ex:Bob ex:parent ex:Alice .`,
    "childShape",
    ex("Bob"),
    ex("Charlie"),
  );
  expect(values).toEqual([ex("Charlie").value]);
});

test("replacePropertyPath - alternative path throws", async () => {
  await expect(
    replace(
      `ex:parentShape a sh:PropertyShape ; sh:path [ sh:alternativePath ( ex:father ex:mother ) ] .`,
      `ex:Alice ex:father ex:Dan .`,
      "parentShape",
      ex("Dan"),
      ex("Don"),
    ),
  ).rejects.toThrow(/Cannot replace a value through a alternative path/);
});

test("replacePropertyPath - zeroOrMore path throws", async () => {
  await expect(
    replace(
      `ex:ancestorShape a sh:PropertyShape ; sh:path [ sh:zeroOrMorePath ex:parent ] .`,
      `ex:Alice ex:parent ex:Bob .`,
      "ancestorShape",
      ex("Bob"),
      ex("Charlie"),
    ),
  ).rejects.toThrow(/Cannot replace a value through a zeroOrMore path/);
});
