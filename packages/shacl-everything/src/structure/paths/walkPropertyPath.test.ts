import { expect, test } from "vite-plus/test";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

async function walk(
  shapeTurtle: string,
  dataTurtle: string,
  shapeName: string,
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

  return walkPropertyPath(path, focusNode, dataGraph).map((term) => term.value);
}

// 4.1 Predicate Paths
test("walkPropertyPath - 4.1 Predicate Paths", async () => {
  const values = await walk(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:name "Alice" .`,
    "nameShape",
  );
  expect(values).toEqual(["Alice"]);
});

test("walkPropertyPath - predicate path with no matching triples returns nothing", async () => {
  const values = await walk(
    `ex:nameShape a sh:PropertyShape ; sh:path ex:name .`,
    `ex:Alice ex:age "30" .`,
    "nameShape",
  );
  expect(values).toEqual([]);
});

// 4.2 Sequence Paths
test("walkPropertyPath - 4.2 Sequence Paths", async () => {
  const values = await walk(
    `ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .`,
    `
        ex:Alice ex:spouse ex:Bob .
        ex:Bob ex:father ex:Charlie .
    `,
    "spouseFatherShape",
  );
  expect(values).toEqual([ex("Charlie").value]);
});

// 4.3 Alternative Paths
test("walkPropertyPath - 4.3 Alternative Paths", async () => {
  const values = await walk(
    `ex:parentShape a sh:PropertyShape ; sh:path [ sh:alternativePath ( ex:father ex:mother ) ] .`,
    `
        ex:Alice ex:father ex:Dan .
        ex:Alice ex:mother ex:Erin .
    `,
    "parentShape",
  );
  expect(values.sort()).toEqual([ex("Dan").value, ex("Erin").value].sort());
});

// 4.4 Inverse Paths
test("walkPropertyPath - 4.4 Inverse Paths", async () => {
  const values = await walk(
    `ex:childShape a sh:PropertyShape ; sh:path [ sh:inversePath ex:parent ] .`,
    `
        ex:Bob ex:parent ex:Alice .
        ex:Charlie ex:parent ex:Alice .
    `,
    "childShape",
  );
  expect(values.sort()).toEqual([ex("Bob").value, ex("Charlie").value].sort());
});

// 4.5 Zero-Or-More Paths
test("walkPropertyPath - 4.5 Zero-Or-More Paths includes the focus node itself", async () => {
  const values = await walk(
    `ex:ancestorShape a sh:PropertyShape ; sh:path [ sh:zeroOrMorePath ex:parent ] .`,
    `
        ex:Alice ex:parent ex:Bob .
        ex:Bob ex:parent ex:Charlie .
    `,
    "ancestorShape",
  );
  expect(values.sort()).toEqual([ex("Alice").value, ex("Bob").value, ex("Charlie").value].sort());
});

test("walkPropertyPath - 4.5 Zero-Or-More Paths terminates on a cycle", async () => {
  const values = await walk(
    `ex:ancestorShape a sh:PropertyShape ; sh:path [ sh:zeroOrMorePath ex:parent ] .`,
    `
        ex:Alice ex:parent ex:Bob .
        ex:Bob ex:parent ex:Alice .
    `,
    "ancestorShape",
  );
  expect(values.sort()).toEqual([ex("Alice").value, ex("Bob").value].sort());
});

// 4.6 One-Or-More Paths
test("walkPropertyPath - 4.6 One-Or-More Paths excludes the focus node", async () => {
  const values = await walk(
    `ex:strictAncestorShape a sh:PropertyShape ; sh:path [ sh:oneOrMorePath ex:parent ] .`,
    `
        ex:Alice ex:parent ex:Bob .
        ex:Bob ex:parent ex:Charlie .
    `,
    "strictAncestorShape",
  );
  expect(values.sort()).toEqual([ex("Bob").value, ex("Charlie").value].sort());
});

// 4.7 Zero-Or-One Paths
test("walkPropertyPath - 4.7 Zero-Or-One Paths", async () => {
  const values = await walk(
    `ex:selfOrParentShape a sh:PropertyShape ; sh:path [ sh:zeroOrOnePath ex:parent ] .`,
    `ex:Alice ex:parent ex:Bob .`,
    "selfOrParentShape",
  );
  expect(values.sort()).toEqual([ex("Alice").value, ex("Bob").value].sort());
});

// Nested combinations
test("walkPropertyPath - inverse of a sequence reverses order and direction of each step", async () => {
  const values = await walk(
    `ex:inverseSequenceShape a sh:PropertyShape ; sh:path [ sh:inversePath ( ex:father ex:mother ) ] .`,
    `
        ex:Bob ex:father ex:Charlie .
        ex:Charlie ex:mother ex:Alice .
    `,
    "inverseSequenceShape",
    ex("Alice"),
  );
  expect(values).toEqual([ex("Bob").value]);
});

test("walkPropertyPath - one-or-more of an inverse path", async () => {
  const values = await walk(
    `ex:strictDescendantShape a sh:PropertyShape ; sh:path [ sh:oneOrMorePath [ sh:inversePath ex:parent ] ] .`,
    `
        ex:Bob ex:parent ex:Alice .
        ex:Charlie ex:parent ex:Bob .
    `,
    "strictDescendantShape",
    ex("Alice"),
  );
  expect(values.sort()).toEqual([ex("Bob").value, ex("Charlie").value].sort());
});
