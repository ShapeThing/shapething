import { expect, test } from "vite-plus/test";
import { knownIris } from "@/helpers/knownIris.ts";
import { parseRdf } from "@/helpers/rdf.ts";

function parse(turtle: string) {
  return parseRdf(
    `
        @prefix ex: <http://example.org/> .

        ${turtle}
    `,
    "text/turtle",
  );
}

test("knownIris - collects distinct IRIs from every quad position, deduped and sorted", async () => {
  const store = await parse(`
        ex:a ex:knows ex:b .
        ex:b ex:knows ex:a .
    `);

  const iris = knownIris(store);
  expect(iris.map((iri) => iri.value)).toEqual([
    "http://example.org/a",
    "http://example.org/b",
    "http://example.org/knows",
  ]);
});

test("knownIris - skips blank nodes and literals", async () => {
  const store = await parse(`
        ex:a ex:label "hello" ; ex:related [ ex:x ex:y ] .
    `);

  const iris = knownIris(store);
  expect(iris.map((iri) => iri.value)).toEqual([
    "http://example.org/a",
    "http://example.org/label",
    "http://example.org/related",
    "http://example.org/x",
    "http://example.org/y",
  ]);
});

test("knownIris - merges IRIs found across several graphs", async () => {
  const dataGraph = await parse(`ex:a ex:knows ex:b .`);
  const shapesGraph = await parse(`ex:Shape ex:targetsClass ex:a .`);

  const iris = knownIris(dataGraph, shapesGraph);
  expect(iris.map((iri) => iri.value)).toEqual([
    "http://example.org/a",
    "http://example.org/b",
    "http://example.org/knows",
    "http://example.org/Shape",
    "http://example.org/targetsClass",
  ]);
});
