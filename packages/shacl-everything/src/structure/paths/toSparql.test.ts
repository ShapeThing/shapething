import { expect, test } from "vite-plus/test";
import { parsePropertyPath } from "./parsePropertyPath.ts";
import { toSparql } from "./toSparql.ts";
import { parseRdf } from "../../helpers/rdf.ts";
import { ex } from "../../helpers/namespaces.ts";

async function compile(turtle: string, shapeName: string) {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ${turtle}
    `,
    "text/turtle",
  );

  const path = parsePropertyPath(ex(shapeName), shapesGraph);
  if (!path) {
    throw new Error(`No sh:path found on ${shapeName}`);
  }
  return toSparql(path);
}

// 4.1 Predicate Paths
test("toSparql - 4.1 Predicate Paths", async () => {
  const sparql = await compile(
    `ex:ingredientShape a sh:PropertyShape ; sh:path ex:ingredient .`,
    "ingredientShape",
  );
  expect(sparql).toBe("<http://example.com/ingredient>");
});

// 4.2 Sequence Paths
test("toSparql - 4.2 Sequence Paths", async () => {
  const sparql = await compile(
    `ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .`,
    "spouseFatherShape",
  );
  expect(sparql).toBe("<http://example.com/spouse>/<http://example.com/father>");
});

// 4.3 Alternative Paths
test("toSparql - 4.3 Alternative Paths", async () => {
  const sparql = await compile(
    `ex:parentShape a sh:PropertyShape ; sh:path [ sh:alternativePath ( ex:father ex:mother ) ] .`,
    "parentShape",
  );
  expect(sparql).toBe("<http://example.com/father>|<http://example.com/mother>");
});

// 4.4 Inverse Paths
test("toSparql - 4.4 Inverse Paths", async () => {
  const sparql = await compile(
    `ex:childShape a sh:PropertyShape ; sh:path [ sh:inversePath ex:parent ] .`,
    "childShape",
  );
  expect(sparql).toBe("^<http://example.com/parent>");
});

// 4.5 Zero-Or-More Paths
test("toSparql - 4.5 Zero-Or-More Paths", async () => {
  const sparql = await compile(
    `ex:ancestorShape a sh:PropertyShape ; sh:path [ sh:zeroOrMorePath ex:parent ] .`,
    "ancestorShape",
  );
  expect(sparql).toBe("<http://example.com/parent>*");
});

// 4.6 One-Or-More Paths
test("toSparql - 4.6 One-Or-More Paths", async () => {
  const sparql = await compile(
    `ex:strictAncestorShape a sh:PropertyShape ; sh:path [ sh:oneOrMorePath ex:parent ] .`,
    "strictAncestorShape",
  );
  expect(sparql).toBe("<http://example.com/parent>+");
});

// 4.7 Zero-Or-One Paths
test("toSparql - 4.7 Zero-Or-One Paths", async () => {
  const sparql = await compile(
    `ex:selfOrParentShape a sh:PropertyShape ; sh:path [ sh:zeroOrOnePath ex:parent ] .`,
    "selfOrParentShape",
  );
  expect(sparql).toBe("<http://example.com/parent>?");
});

// Deeply nested combinations - SPARQL has native grouping, so these never
// need to throw, unlike toGrapoi.

test("toSparql - alternative of two sequences", async () => {
  const sparql = await compile(
    `ex:byMotherOrFatherShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath ( ( ex:mother ex:name ) ( ex:father ex:name ) ) ] .`,
    "byMotherOrFatherShape",
  );
  expect(sparql).toBe(
    "(<http://example.com/mother>/<http://example.com/name>)|(<http://example.com/father>/<http://example.com/name>)",
  );
});

test("toSparql - alternative mixing a predicate and an inverse path", async () => {
  const sparql = await compile(
    `ex:relatedShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath ( ex:father [ sh:inversePath ex:child ] ) ] .`,
    "relatedShape",
  );
  expect(sparql).toBe("<http://example.com/father>|(^<http://example.com/child>)");
});

test("toSparql - inverse of a sequence", async () => {
  const sparql = await compile(
    `ex:inverseSequenceShape a sh:PropertyShape ;
            sh:path [ sh:inversePath ( ex:father ex:mother ) ] .`,
    "inverseSequenceShape",
  );
  expect(sparql).toBe("^(<http://example.com/father>/<http://example.com/mother>)");
});

test("toSparql - zero-or-more over a sequence", async () => {
  const sparql = await compile(
    `ex:zeroOrMoreSequenceShape a sh:PropertyShape ;
            sh:path [ sh:zeroOrMorePath ( ex:parent ex:sibling ) ] .`,
    "zeroOrMoreSequenceShape",
  );
  expect(sparql).toBe("(<http://example.com/parent>/<http://example.com/sibling>)*");
});

test("toSparql - one-or-more of an inverse path", async () => {
  const sparql = await compile(
    `ex:strictDescendantShape a sh:PropertyShape ;
            sh:path [ sh:oneOrMorePath [ sh:inversePath ex:parent ] ] .`,
    "strictDescendantShape",
  );
  expect(sparql).toBe("(^<http://example.com/parent>)+");
});

test("toSparql - sequence containing an alternative", async () => {
  const sparql = await compile(
    `ex:parentThenNameShape a sh:PropertyShape ;
            sh:path ( [ sh:alternativePath ( ex:father ex:mother ) ] ex:name ) .`,
    "parentThenNameShape",
  );
  expect(sparql).toBe(
    "(<http://example.com/father>|<http://example.com/mother>)/<http://example.com/name>",
  );
});

test("toSparql - zero-or-one wrapping a one-or-more path", async () => {
  const sparql = await compile(
    `ex:maybeAncestorShape a sh:PropertyShape ;
            sh:path [ sh:zeroOrOnePath [ sh:oneOrMorePath ex:parent ] ] .`,
    "maybeAncestorShape",
  );
  expect(sparql).toBe("(<http://example.com/parent>+)?");
});
