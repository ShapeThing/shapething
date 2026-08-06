import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { resolveRdfSources } from "@/preprocess/resolveRdfSources.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { ex } from "@/helpers/namespaces.ts";

let fixtures: Record<string, string> = {};
let fetchCalls: string[] = [];

beforeEach(() => {
  fixtures = {};
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      fetchCalls.push(url.href);
      const text = fixtures[url.href];
      if (text === undefined) throw new Error(`Unexpected fetch: ${url.href}`);
      return new Response(text, { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const rawEnvironment = (overrides: Partial<RawEnvironment>): RawEnvironment => ({
  ...defaultEnvironment,
  scoresGraph: RdfStore.createDefault(),
  ...overrides,
});

test("owl:imports on a dereferenced graph pulls in and merges the imported graph", async () => {
  fixtures["http://example.com/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.com/> .
    ex:a owl:imports <http://example.com/b.ttl> .
    ex:a ex:name "A" .
  `;
  fixtures["http://example.com/b.ttl"] = `
    @prefix ex: <http://example.com/> .
    ex:b ex:name "B" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.com/a.ttl") }),
  );

  expect(environment.dataGraph.getQuads(ex("a"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
});

test("owl:imports is resolved transitively", async () => {
  fixtures["http://example.com/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.com/> .
    ex:a owl:imports <http://example.com/b.ttl> .
  `;
  fixtures["http://example.com/b.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.com/> .
    ex:b owl:imports <http://example.com/c.ttl> .
  `;
  fixtures["http://example.com/c.ttl"] = `
    @prefix ex: <http://example.com/> .
    ex:c ex:name "C" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.com/a.ttl") }),
  );

  expect(environment.dataGraph.getQuads(ex("c"), ex("name")).length).toBe(1);
});

test("an import cycle terminates instead of looping forever", async () => {
  fixtures["http://example.com/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.com/> .
    ex:a owl:imports <http://example.com/b.ttl> .
    ex:a ex:name "A" .
  `;
  fixtures["http://example.com/b.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.com/> .
    ex:b owl:imports <http://example.com/a.ttl> .
    ex:b ex:name "B" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.com/a.ttl") }),
  );

  expect(environment.dataGraph.getQuads(ex("a"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
  expect(fetchCalls.sort()).toEqual(
    ["http://example.com/a.ttl", "http://example.com/b.ttl"].sort(),
  );
});

test("the same import reached from multiple sources is only fetched once", async () => {
  fixtures["http://example.com/shapes.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    <http://example.com/shapes.ttl> owl:imports <http://example.com/shared.ttl> .
  `;
  fixtures["http://example.com/data.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    <http://example.com/data.ttl> owl:imports <http://example.com/shared.ttl> .
  `;
  fixtures["http://example.com/shared.ttl"] = `
    @prefix ex: <http://example.com/> .
    ex:shared ex:name "shared" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      shapesGraph: new URL("http://example.com/shapes.ttl"),
      dataGraph: new URL("http://example.com/data.ttl"),
    }),
  );

  expect(environment.shapesGraph.getQuads(ex("shared"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("shared"), ex("name")).length).toBe(1);
  expect(fetchCalls.filter((href) => href === "http://example.com/shared.ttl").length).toBe(1);
});
