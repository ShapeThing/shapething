import "fake-indexeddb/auto";
import type { NamedNode, Quad } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { beforeEach, expect, test, vi } from "vitest";
import { clearImportCache } from "./importCache.ts";
import { loadDataModel, type LoadGraph } from "./loadDataModel.ts";

const factory = new DataFactory();
const owlImports = factory.namedNode("http://www.w3.org/2002/07/owl#imports");
const label = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#label");
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);

// main imports a and b, a imports c and (cyclically) main, b is unreachable.
const graphs: Record<string, Quad[]> = {
  main: [
    factory.quad(iri("main"), owlImports, iri("a"), iri("main")),
    factory.quad(iri("main"), owlImports, iri("b"), iri("main")),
  ],
  a: [
    factory.quad(iri("a"), owlImports, iri("c"), iri("a")),
    factory.quad(iri("a"), owlImports, iri("main"), iri("a")),
    factory.quad(factory.blankNode("x"), label, factory.literal("A", "en"), iri("a")),
  ],
  c: [factory.quad(factory.blankNode("x"), label, factory.literal("C"), iri("c"))],
};

// main and a both declare ex:, main's own declaration wins.
const prefixes: Record<string, Record<string, string>> = {
  main: { ex: "http://example.org/main#" },
  a: { ex: "http://example.org/a#", a: "http://example.org/a#" },
  c: { c: "http://example.org/c#" },
};

const expectedPrefixes = {
  ex: "http://example.org/main#",
  a: "http://example.org/a#",
  c: "http://example.org/c#",
};

const createLoadGraph = () =>
  vi.fn<LoadGraph>(async (graph: NamedNode) => {
    const name = graph.value.replace("http://example.org/", "");
    if (!graphs[name]) throw new Error("unreachable");
    return { quads: graphs[name], prefixes: prefixes[name] ?? {} };
  });

beforeEach(async () => {
  await clearImportCache();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

test("follows owl:imports transitively, survives cycles and dead imports", async () => {
  const loadGraph = createLoadGraph();
  const dataModel = await loadDataModel(iri("main"), loadGraph);

  expect(dataModel.importedGraphIRIs.map((graph) => graph.value).sort()).toEqual([
    "http://example.org/a",
    "http://example.org/c",
  ]);
  expect(dataModel.cachedGraphIRIs).toEqual([]);
  expect(dataModel.unresolvableGraphIRIs.map((graph) => graph.value)).toEqual([
    "http://example.org/b",
  ]);
  expect(dataModel.store.size).toBe(6);
  expect(dataModel.prefixes).toEqual(expectedPrefixes);
  expect(loadGraph).toHaveBeenCalledTimes(4); // main, a, b (fails), c
});

test("a second load reads imports (and known failures) from the cache, but refetches the data model", async () => {
  await loadDataModel(iri("main"), createLoadGraph());
  // The cache write is fire-and-forget; give IndexedDB a moment.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const loadGraph = createLoadGraph();
  const dataModel = await loadDataModel(iri("main"), loadGraph);

  expect(loadGraph.mock.calls.map(([graph]) => graph.value)).toEqual(["http://example.org/main"]);
  expect(dataModel.unresolvableGraphIRIs.map((graph) => graph.value)).toEqual([
    "http://example.org/b",
  ]);
  expect(dataModel.cachedGraphIRIs.map((graph) => graph.value).sort()).toEqual([
    "http://example.org/a",
    "http://example.org/c",
  ]);
  expect(dataModel.store.size).toBe(6);
  // Prefixes come back from the cache too.
  expect(dataModel.prefixes).toEqual(expectedPrefixes);

  // Literals survive the round trip, and blank nodes of different graphs stay distinct.
  const labels = dataModel.store.getQuads(null, label);
  expect(labels.map((quad) => quad.object)).toEqual(
    expect.arrayContaining([factory.literal("A", "en"), factory.literal("C")]),
  );
  expect(new Set(labels.map((quad) => quad.subject.value)).size).toBe(2);
});
