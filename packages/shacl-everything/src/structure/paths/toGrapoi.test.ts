import { expect, test } from "vite-plus/test";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toGrapoi } from "@/structure/paths/toGrapoi.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex } from "@/helpers/namespaces.ts";

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
  return toGrapoi(path);
}

// 4.1 Predicate Paths
test("toGrapoi - 4.1 Predicate Paths", async () => {
  const instructions = await compile(
    `ex:ingredientShape a sh:PropertyShape ; sh:path ex:ingredient .`,
    "ingredientShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "one",
      start: "subject",
      end: "object",
      predicates: [ex("ingredient")],
    },
  ]);
});

// 4.2 Sequence Paths
test("toGrapoi - 4.2 Sequence Paths", async () => {
  const instructions = await compile(
    `ex:spouseFatherShape a sh:PropertyShape ; sh:path ( ex:spouse ex:father ) .`,
    "spouseFatherShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "one",
      start: "subject",
      end: "object",
      predicates: [ex("spouse")],
    },
    {
      quantifier: "one",
      start: "subject",
      end: "object",
      predicates: [ex("father")],
    },
  ]);
});

// 4.3 Alternative Paths
test("toGrapoi - 4.3 Alternative Paths", async () => {
  const instructions = await compile(
    `ex:parentShape a sh:PropertyShape ; sh:path [ sh:alternativePath ( ex:father ex:mother ) ] .`,
    "parentShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "one",
      start: "subject",
      end: "object",
      predicates: [ex("father"), ex("mother")],
    },
  ]);
});

// 4.4 Inverse Paths
test("toGrapoi - 4.4 Inverse Paths", async () => {
  const instructions = await compile(
    `ex:childShape a sh:PropertyShape ; sh:path [ sh:inversePath ex:parent ] .`,
    "childShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "one",
      start: "object",
      end: "subject",
      predicates: [ex("parent")],
    },
  ]);
});

// 4.5 Zero-Or-More Paths
test("toGrapoi - 4.5 Zero-Or-More Paths", async () => {
  const instructions = await compile(
    `ex:ancestorShape a sh:PropertyShape ; sh:path [ sh:zeroOrMorePath ex:parent ] .`,
    "ancestorShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "zeroOrMore",
      start: "subject",
      end: "object",
      predicates: [ex("parent")],
    },
  ]);
});

// 4.6 One-Or-More Paths
test("toGrapoi - 4.6 One-Or-More Paths", async () => {
  const instructions = await compile(
    `ex:strictAncestorShape a sh:PropertyShape ; sh:path [ sh:oneOrMorePath ex:parent ] .`,
    "strictAncestorShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "oneOrMore",
      start: "subject",
      end: "object",
      predicates: [ex("parent")],
    },
  ]);
});

// 4.7 Zero-Or-One Paths
test("toGrapoi - 4.7 Zero-Or-One Paths", async () => {
  const instructions = await compile(
    `ex:selfOrParentShape a sh:PropertyShape ; sh:path [ sh:zeroOrOnePath ex:parent ] .`,
    "selfOrParentShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "zeroOrOne",
      start: "subject",
      end: "object",
      predicates: [ex("parent")],
    },
  ]);
});

// Nested combinations that collapse correctly onto Grapoi's flat instructions

test("toGrapoi - inverse of a sequence reverses order and direction of each step", async () => {
  const instructions = await compile(
    `ex:inverseSequenceShape a sh:PropertyShape ; sh:path [ sh:inversePath ( ex:father ex:mother ) ] .`,
    "inverseSequenceShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "one",
      start: "object",
      end: "subject",
      predicates: [ex("mother")],
    },
    {
      quantifier: "one",
      start: "object",
      end: "subject",
      predicates: [ex("father")],
    },
  ]);
});

test("toGrapoi - one-or-more of an inverse path", async () => {
  const instructions = await compile(
    `ex:strictDescendantShape a sh:PropertyShape ; sh:path [ sh:oneOrMorePath [ sh:inversePath ex:parent ] ] .`,
    "strictDescendantShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "oneOrMore",
      start: "object",
      end: "subject",
      predicates: [ex("parent")],
    },
  ]);
});

test("toGrapoi - sequence containing an alternative", async () => {
  const instructions = await compile(
    `ex:parentThenNameShape a sh:PropertyShape ;
            sh:path ( [ sh:alternativePath ( ex:father ex:mother ) ] ex:name ) .`,
    "parentThenNameShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "one",
      start: "subject",
      end: "object",
      predicates: [ex("father"), ex("mother")],
    },
    {
      quantifier: "one",
      start: "subject",
      end: "object",
      predicates: [ex("name")],
    },
  ]);
});

test("toGrapoi - zero-or-one wrapping a one-or-more path collapses to zero-or-more", async () => {
  // (p+)? is equivalent to p*
  const instructions = await compile(
    `ex:maybeAncestorShape a sh:PropertyShape ; sh:path [ sh:zeroOrOnePath [ sh:oneOrMorePath ex:parent ] ] .`,
    "maybeAncestorShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "zeroOrMore",
      start: "subject",
      end: "object",
      predicates: [ex("parent")],
    },
  ]);
});

test("toGrapoi - one-or-more wrapping a zero-or-one path collapses to zero-or-more", async () => {
  // (p?)+ is equivalent to p*
  const instructions = await compile(
    `ex:relaxedAncestorShape a sh:PropertyShape ; sh:path [ sh:oneOrMorePath [ sh:zeroOrOnePath ex:parent ] ] .`,
    "relaxedAncestorShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "zeroOrMore",
      start: "subject",
      end: "object",
      predicates: [ex("parent")],
    },
  ]);
});

test("toGrapoi - quantifier wrapping an alternative applies to every option", async () => {
  const instructions = await compile(
    `ex:relativesShape a sh:PropertyShape ;
            sh:path [ sh:zeroOrMorePath [ sh:alternativePath ( ex:father ex:mother ) ] ] .`,
    "relativesShape",
  );
  expect(instructions).toEqual([
    {
      quantifier: "zeroOrMore",
      start: "subject",
      end: "object",
      predicates: [ex("father"), ex("mother")],
    },
  ]);
});

// Nested combinations that have no equivalent Grapoi instruction list

test("toGrapoi - alternative of two sequences is unsupported", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ex:byMotherOrFatherShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath ( ( ex:mother ex:name ) ( ex:father ex:name ) ) ] .
    `,
    "text/turtle",
  );
  const path = parsePropertyPath(ex("byMotherOrFatherShape"), shapesGraph);
  expect(() => toGrapoi(path!)).toThrow();
});

test("toGrapoi - alternative mixing forward and inverse directions is unsupported", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ex:relatedShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath ( ex:father [ sh:inversePath ex:child ] ) ] .
    `,
    "text/turtle",
  );
  const path = parsePropertyPath(ex("relatedShape"), shapesGraph);
  expect(() => toGrapoi(path!)).toThrow();
});

test("toGrapoi - alternative mixing quantifiers is unsupported", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ex:relatedShape a sh:PropertyShape ;
            sh:path [ sh:alternativePath ( [ sh:zeroOrMorePath ex:father ] ex:mother ) ] .
    `,
    "text/turtle",
  );
  const path = parsePropertyPath(ex("relatedShape"), shapesGraph);
  expect(() => toGrapoi(path!)).toThrow();
});

test("toGrapoi - quantifier over a multi-step sequence is unsupported", async () => {
  const shapesGraph = await parseRdf(
    `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.com/> .

        ex:zeroOrMoreSequenceShape a sh:PropertyShape ;
            sh:path [ sh:zeroOrMorePath ( ex:parent ex:sibling ) ] .
    `,
    "text/turtle",
  );
  const path = parsePropertyPath(ex("zeroOrMoreSequenceShape"), shapesGraph);
  expect(() => toGrapoi(path!)).toThrow();
});
