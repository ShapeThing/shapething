import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { dereferenceMissingPropertyNames } from "@/preprocess/ontologyLabels.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, rdf, rdfs, sh } from "@/helpers/namespaces.ts";

let fixtures: Record<string, string> = {};
let fetchCalls: string[] = [];

beforeEach(() => {
  fixtures = {};
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const href = input instanceof Request ? input.url : input.toString();
      fetchCalls.push(href);
      const text = fixtures[href];
      if (text === undefined) return new Response("Not Found", { status: 404 });
      return new Response(text, { status: 200, headers: { "content-type": "text/turtle" } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const rawEnvironment = (overrides: Partial<RawEnvironment>): RawEnvironment => ({
  ...defaultEnvironment,
  dataGraph: RdfStore.createDefault(),
  scoresGraph: RdfStore.createDefault(),
  ...overrides,
});

test("does nothing unless enableMissingPropertyNameDereferencing is on", async () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("nameShape"), sh("path"), ex("name")));

  const result = await dereferenceMissingPropertyNames(rawEnvironment({ shapesGraph }));

  expect(result.shapesGraph).toBe(shapesGraph);
  expect(fetchCalls).toHaveLength(0);
});

test("dereferences an unnamed property shape's own path predicate and merges its rdfs:label", async () => {
  fixtures["http://example.org/name"] = `
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    <http://example.org/name> rdfs:label "Name"@en .
  `;

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("nameShape"), sh("path"), ex("name")));

  const result = await dereferenceMissingPropertyNames(
    rawEnvironment({ shapesGraph, enableMissingPropertyNameDereferencing: true }),
  );
  const resultShapes = result.shapesGraph as RdfStore;

  const labels = resultShapes.getQuads(ex("name"), rdfs("label"));
  expect(labels).toHaveLength(1);
  expect(labels[0].object.value).toBe("Name");
});

test("leaves a property shape alone, and never fetches its predicate, when it already has an sh:name", async () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("nameShape"), sh("path"), ex("name")));
  shapesGraph.addQuad(factory.quad(ex("nameShape"), sh("name"), factory.literal("Naam", "nl")));

  const result = await dereferenceMissingPropertyNames(
    rawEnvironment({ shapesGraph, enableMissingPropertyNameDereferencing: true }),
  );

  expect(result.shapesGraph).toBe(shapesGraph);
  expect(fetchCalls).toHaveLength(0);
});

test("the same path predicate shared by multiple unnamed property shapes is only dereferenced once", async () => {
  // A dedicated URL, not reused by any other test in this file: Comunica's engine (module-level,
  // shared across this whole test file - see ontologyLabels.ts's own getEngine()) caches a
  // dereferenced source internally, so a URL another test already fetched could be served from
  // that cache here without hitting global fetch again - which would make this assertion pass for
  // the wrong reason. The behavior actually under test (predicatesMissingAName's own dedup, which
  // runs before any network activity) doesn't depend on that cache either way.
  fixtures["http://example.org/shared-name"] = `
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    <http://example.org/shared-name> rdfs:label "Name"@en .
  `;

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("aShape"), sh("path"), ex("shared-name")));
  shapesGraph.addQuad(factory.quad(ex("bShape"), sh("path"), ex("shared-name")));

  await dereferenceMissingPropertyNames(
    rawEnvironment({ shapesGraph, enableMissingPropertyNameDereferencing: true }),
  );

  expect(fetchCalls.filter((href) => href === "http://example.org/shared-name")).toHaveLength(1);
});

test("a compound (non-plain-predicate) sh:path has no single IRI to dereference and is left alone", async () => {
  const shapesGraph = RdfStore.createDefault();
  const pathNode = factory.blankNode();
  shapesGraph.addQuad(factory.quad(pathNode, sh("inversePath"), ex("name")));
  shapesGraph.addQuad(factory.quad(ex("nameShape"), sh("path"), pathNode));

  const result = await dereferenceMissingPropertyNames(
    rawEnvironment({ shapesGraph, enableMissingPropertyNameDereferencing: true }),
  );

  expect(result.shapesGraph).toBe(shapesGraph);
  expect(fetchCalls).toHaveLength(0);
});

test("only the term label predicate is merged - other triples in the same fetched document are left out", async () => {
  fixtures["http://example.org/name"] = `
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    <http://example.org/name> rdfs:label "Name"@en .
    <http://example.org/name> rdf:type owl:DatatypeProperty .
    <http://example.org/other> rdfs:label "Other"@en .
  `;

  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("nameShape"), sh("path"), ex("name")));

  const result = await dereferenceMissingPropertyNames(
    rawEnvironment({ shapesGraph, enableMissingPropertyNameDereferencing: true }),
  );
  const resultShapes = result.shapesGraph as RdfStore;

  expect(resultShapes.getQuads(ex("name"), rdfs("label"))).toHaveLength(1);
  expect(resultShapes.getQuads(ex("name"), rdf("type"))).toHaveLength(0);
  expect(resultShapes.getQuads(ex("other"), rdfs("label"))).toHaveLength(0);
});

test("a predicate that fails to dereference is skipped, not thrown", async () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("nameShape"), sh("path"), ex("dead")));
  // "http://example.org/dead" is deliberately absent from fixtures, so the stubbed fetch above
  // throws for it on every attempt (including retries) - simulating a permanently dead URL.

  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const result = await dereferenceMissingPropertyNames(
    rawEnvironment({ shapesGraph, enableMissingPropertyNameDereferencing: true }),
  );

  expect((result.shapesGraph as RdfStore).getQuads()).toHaveLength(1); // just the original sh:path triple
  expect(warnSpy).toHaveBeenCalled();

  warnSpy.mockRestore();
});
