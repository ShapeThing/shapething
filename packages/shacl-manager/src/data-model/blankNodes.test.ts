import type { BlankNode } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { blankNodeId, findBlankNode } from "./blankNodes.ts";
import { segmentToTerm, termToSegment } from "./segments.ts";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const owl = (local: string) => factory.namedNode(`http://www.w3.org/2002/07/owl#${local}`);
const rdf = (local: string) =>
  factory.namedNode(`http://www.w3.org/1999/02/22-rdf-syntax-ns#${local}`);
const graph = iri("graph");

// The same Turtle parsed twice: a restriction and an owl:unionOf over an RDF list, with labels
// that differ per load, as a parser makes them up.
function load(labels: string) {
  const b = (name: string) => factory.blankNode(`${labels}${name}`);
  const store = RdfStore.createDefault();
  for (const [s, p, o] of [
    [b("restriction"), rdf("type"), owl("Restriction")],
    [b("restriction"), owl("onProperty"), iri("age")],
    [b("restriction"), owl("maxCardinality"), factory.literal("1")],
    [b("union"), owl("unionOf"), b("list1")],
    [b("list1"), rdf("first"), iri("Person")],
    [b("list1"), rdf("rest"), b("list2")],
    [b("list2"), rdf("first"), iri("Organisation")],
    [b("list2"), rdf("rest"), rdf("nil")],
  ] as const) {
    store.addQuad(factory.quad(s, p, o, graph));
  }
  return { store, b, prefixes: {} };
}

test("the same content gets the same id on every load", () => {
  const first = load("a");
  const second = load("x");
  for (const name of ["restriction", "union"]) {
    expect(blankNodeId(first.store, first.b(name))).toBe(blankNodeId(second.store, second.b(name)));
  }
  expect(blankNodeId(first.store, first.b("restriction"))).not.toBe(
    blankNodeId(first.store, first.b("union")),
  );
});

test("a segment from one load finds the node in the next", () => {
  const first = load("a");
  const second = load("x");
  const segment = termToSegment(first.b("union"), first);
  expect(segment).toMatch(/^_:[0-9a-z]+$/);
  expect((segmentToTerm(segment, second) as BlankNode).value).toBe("xunion");
  expect(findBlankNode(second.store, "nothere")).toBeUndefined();
});

test("named nodes still go by prefixed name", () => {
  const context = { ...load("a"), prefixes: { ex: "http://example.org/" } };
  expect(termToSegment(iri("Person"), context)).toBe("ex:Person");
  expect(segmentToTerm("ex:Person", context)?.value).toBe("http://example.org/Person");
});

test("nodes with identical content still get their own id", () => {
  const twins = (labels: string) => {
    const store = RdfStore.createDefault();
    for (const name of ["one", "two"]) {
      const node = factory.blankNode(`${labels}${name}`);
      store.addQuad(factory.quad(iri(name), iri("domain"), node, graph));
      store.addQuad(factory.quad(node, rdf("type"), owl("Class"), graph));
    }
    return store;
  };
  const first = twins("a");
  const second = twins("x");
  const one = blankNodeId(first, factory.blankNode("aone"));
  const two = blankNodeId(first, factory.blankNode("atwo"));
  expect(one).not.toBe(two);
  expect(findBlankNode(second, one)?.value).toBe("xone");
  expect(findBlankNode(second, two)?.value).toBe("xtwo");
});
