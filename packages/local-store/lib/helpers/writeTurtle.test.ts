import type { Quad } from "@rdfjs/types";
import { DataFactory, Parser, Store } from "n3";
import { expect, test } from "vitest";
import { stripRelativeTtlExtensions } from "./fileReferences.ts";
import { writeTurtle } from "./writeTurtle.ts";

const { namedNode, literal, quad } = DataFactory;
const schema = (name: string) => namedNode(`https://schema.org/${name}`);
const type = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

// Reads the Turtle back the way LocalStore does: relative to the graph, .ttl references stripped.
const read = (turtle: string, graph: string) =>
  new Parser({ baseIRI: graph }).parse(stripRelativeTtlExtensions(turtle));

const sameQuads = (actual: Quad[], expected: Quad[]) => {
  const store = new Store(actual);
  expect(store.size).toBe(expected.length);
  for (const quad of expected) expect(store.has(quad)).toBe(true);
};

const contactQuads = (graph: string) => [
  quad(namedNode(graph), type, schema("Person")),
  quad(namedNode(graph), schema("name"), literal("Ada Lovelace")),
  quad(namedNode(graph), schema("knows"), namedNode(graph.replace(/[^/]+$/, "charles"))),
  quad(namedNode(graph), schema("subjectOf"), namedNode(`${graph}#card`)),
  quad(
    namedNode(`${graph}#card`),
    schema("about"),
    namedNode(graph.replace(/contacts\/.*$/, "contact-shape#Contact")),
  ),
  quad(namedNode(graph), schema("alternateName"), literal("Ada", "en")),
];

for (const graph of ["file:///book/contacts/ada", "https://example.com/book/contacts/ada"]) {
  test(`writes IRIs relative to a ${graph.split(":")[0]}: graph, and they read back the same`, async () => {
    const quads = contactQuads(graph);
    const turtle = await writeTurtle(quads, graph, { schema: "https://schema.org/" });

    expect(turtle).toContain("<> a schema:Person");
    expect(turtle).toContain("<charles>");
    expect(turtle).toContain("<#card>");
    expect(turtle).toContain("<../contact-shape#Contact>");
    expect(turtle).not.toContain(".invalid");
    sameQuads(read(turtle, graph), quads);
  });
}

test("a file: graph's file: prefixes and datatypes are written and read back", async () => {
  const graph = "file:///book/vocab";
  const quads = [
    quad(
      namedNode(`${graph}#Thing`),
      namedNode(`${graph}#size`),
      literal("3", namedNode(`${graph}#unit`)),
    ),
  ];
  const turtle = await writeTurtle(quads, graph, { v: `${graph}#` });
  expect(turtle).toContain(`@prefix v: <${graph}#> .`);
  expect(turtle).toContain("v:Thing v:size");
  sameQuads(read(turtle, graph), quads);
});

test("an IRI of a .ttl file and an IRI of another origin stay absolute", async () => {
  const graph = "file:///book/contacts/ada";
  const quads = [
    quad(namedNode(graph), schema("url"), namedNode("file:///book/notes.ttl")),
    quad(namedNode(graph), schema("sameAs"), namedNode("https://example.com/ada")),
    quad(namedNode(graph), schema("image"), namedNode("file://server/share/ada.png")),
  ];
  const turtle = await writeTurtle(quads, graph, {});
  expect(turtle).toContain("<file:///book/notes.ttl>");
  expect(turtle).toContain("<https://example.com/ada>");
  expect(turtle).toContain("<file://server/share/ada.png>");
  sameQuads(read(turtle, graph), quads);
});

test("the default graph is written with absolute IRIs", async () => {
  const quads = [quad(namedNode("file:///book/a"), schema("name"), literal("A"))];
  const turtle = await writeTurtle(quads, undefined, {});
  expect(turtle).toContain("<file:///book/a>");
});
