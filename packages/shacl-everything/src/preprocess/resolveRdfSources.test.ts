import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { resolveRdfSources } from "@/preprocess/resolveRdfSources.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { ex, owl } from "@/helpers/namespaces.ts";
import { factory } from "@/helpers/factory.ts";
import { isKnownNotFound } from "@/helpers/notFoundCache.ts";

// The Node test environment has no global localStorage - this reproduces just enough of its
// synchronous Storage API for notFoundCache.ts to read/write against, in-memory, per test.
const stubLocalStorage = (): void => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
};

let fixtures: Record<string, string> = {};
let fetchCalls: string[] = [];

beforeEach(() => {
  fixtures = {};
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    // Accepts a plain string too, not just a URL - dereferenceUrl fetches a proxied URL as a
    // plain string (withCorsProxy's return type), not a URL instance.
    vi.fn(async (url: URL | string) => {
      const href = String(url);
      fetchCalls.push(href);
      const text = fixtures[href];
      if (text === undefined) throw new Error(`Unexpected fetch: ${href}`);
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
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/b.ttl> .
    ex:a ex:name "A" .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.org/a.ttl") }),
  );

  expect(environment.dataGraph.getQuads(ex("a"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
});

test("owl:imports is resolved transitively", async () => {
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/b.ttl> .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:b owl:imports <http://example.org/c.ttl> .
  `;
  fixtures["http://example.org/c.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:c ex:name "C" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.org/a.ttl") }),
  );

  expect(environment.dataGraph.getQuads(ex("c"), ex("name")).length).toBe(1);
});

test("an import cycle terminates instead of looping forever", async () => {
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/b.ttl> .
    ex:a ex:name "A" .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:b owl:imports <http://example.org/a.ttl> .
    ex:b ex:name "B" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.org/a.ttl") }),
  );

  expect(environment.dataGraph.getQuads(ex("a"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
  expect(fetchCalls.sort()).toEqual(
    ["http://example.org/a.ttl", "http://example.org/b.ttl"].sort(),
  );
});

test("a dead owl:imports URL is skipped instead of failing the whole resolve", async () => {
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/dead.ttl> .
    ex:a owl:imports <http://example.org/b.ttl> .
    ex:a ex:name "A" .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
  `;
  // "http://example.org/dead.ttl" is deliberately absent from fixtures, so the stubbed fetch
  // above throws for it on every attempt (including retries) - simulating a permanently dead URL.

  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.org/a.ttl") }),
  );

  expect(environment.dataGraph.getQuads(ex("a"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
  expect(warnSpy).toHaveBeenCalled();

  warnSpy.mockRestore();
});

test("sh:shape on the data graph dereferences and bootstraps an empty shapes graph", async () => {
  fixtures["http://example.org/data.ttl"] = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    ex:alice a ex:Person ; sh:shape <http://example.org/PersonShape.ttl> .
  `;
  fixtures["http://example.org/PersonShape.ttl"] = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    <http://example.org/PersonShape.ttl> a sh:NodeShape .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.org/data.ttl") }),
  );

  expect(
    environment.shapesGraph.getQuads(ex("PersonShape.ttl"), null, null).length,
  ).toBeGreaterThan(0);
});

test("sh:shape dereferencing is skipped when a shapes graph was already supplied", async () => {
  fixtures["http://example.org/data.ttl"] = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    ex:alice a ex:Person ; sh:shape <http://example.org/PersonShape.ttl> .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      shapesGraph: `@prefix ex: <http://example.org/> . ex:SomeShape a <http://www.w3.org/ns/shacl#NodeShape> .`,
      dataGraph: new URL("http://example.org/data.ttl"),
    }),
  );

  expect(environment.shapesGraph.size).toBe(1);
  expect(fetchCalls).not.toContain("http://example.org/PersonShape.ttl");
});

test("a dead sh:shape URL is skipped instead of failing the whole resolve", async () => {
  fixtures["http://example.org/data.ttl"] = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    ex:alice a ex:Person ; sh:shape <http://example.org/dead.ttl> .
  `;
  // "http://example.org/dead.ttl" is deliberately absent from fixtures, so the stubbed fetch
  // above throws for it on every attempt (including retries) - simulating a permanently dead URL.

  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.org/data.ttl") }),
  );

  expect(environment.shapesGraph.size).toBe(0);
  expect(warnSpy).toHaveBeenCalled();

  warnSpy.mockRestore();
});

test("an array of sources is merged into a single graph", async () => {
  fixtures["http://example.org/a.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:a ex:name "A" .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      dataGraph: [new URL("http://example.org/a.ttl"), new URL("http://example.org/b.ttl")],
    }),
  );

  expect(environment.dataGraph.getQuads(ex("a"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
});

test("a merged array of sources still resolves each source's own owl:imports", async () => {
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/imported.ttl> .
  `;
  fixtures["http://example.org/imported.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:imported ex:name "imported" .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      dataGraph: [new URL("http://example.org/a.ttl"), new URL("http://example.org/b.ttl")],
    }),
  );

  expect(environment.dataGraph.getQuads(ex("imported"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
});

test("the same import reached from multiple sources is only fetched once", async () => {
  fixtures["http://example.org/shapes.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    <http://example.org/shapes.ttl> owl:imports <http://example.org/shared.ttl> .
  `;
  fixtures["http://example.org/data.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    <http://example.org/data.ttl> owl:imports <http://example.org/shared.ttl> .
  `;
  fixtures["http://example.org/shared.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:shared ex:name "shared" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      shapesGraph: new URL("http://example.org/shapes.ttl"),
      dataGraph: new URL("http://example.org/data.ttl"),
    }),
  );

  expect(environment.shapesGraph.getQuads(ex("shared"), ex("name")).length).toBe(1);
  expect(environment.dataGraph.getQuads(ex("shared"), ex("name")).length).toBe(1);
  expect(fetchCalls.filter((href) => href === "http://example.org/shared.ttl").length).toBe(1);
});

test(
  "a 404 owl:imports URL is remembered in localStorage and skipped on a later resolve",
  async () => {
    stubLocalStorage();
    fixtures["http://example.org/a.ttl"] = `
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix ex: <http://example.org/> .
      ex:a owl:imports <http://example.org/dead-404.ttl> .
      ex:a ex:name "A" .
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        fetchCalls.push(url.href);
        const text = fixtures[url.href];
        if (text !== undefined) return new Response(text, { status: 200 });
        return new Response("Not Found", { status: 404, statusText: "Not Found" });
      }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await resolveRdfSources(
      rawEnvironment({ dataGraph: new URL("http://example.org/a.ttl") }),
    );

    expect(isKnownNotFound("http://example.org/dead-404.ttl")).toBe(true);
    const fetchesAfterFirstResolve = fetchCalls.filter(
      (href) => href === "http://example.org/dead-404.ttl",
    ).length;
    expect(fetchesAfterFirstResolve).toBeGreaterThan(0);

    await resolveRdfSources(
      rawEnvironment({ dataGraph: new URL("http://example.org/a.ttl") }),
    );

    expect(
      fetchCalls.filter((href) => href === "http://example.org/dead-404.ttl").length,
    ).toBe(fetchesAfterFirstResolve);

    warnSpy.mockRestore();
  },
  10000,
);

test("a cross-origin owl:imports URL with a proxy configured skips the direct attempt entirely", async () => {
  vi.stubGlobal("location", { origin: "http://example.org" });
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://cross-origin.example/b.ttl> .
    ex:a ex:name "A" .
  `;
  const proxiedUrl = "http://example.org/proxy?url=http%3A%2F%2Fcross-origin.example%2Fb.ttl";
  fixtures[proxiedUrl] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      dataGraph: new URL("http://example.org/a.ttl"),
      corsProxyUrl: "http://example.org/proxy?url=",
    }),
  );

  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
  expect(fetchCalls).not.toContain("http://cross-origin.example/b.ttl");
  // Exactly one fetch, straight to the proxy - no retries against the doomed direct URL first.
  expect(fetchCalls.filter((href) => href === proxiedUrl).length).toBe(1);
});

test("a same-origin owl:imports URL still tries directly first even with a proxy configured", async () => {
  vi.stubGlobal("location", { origin: "http://example.org" });
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/b.ttl> .
    ex:a ex:name "A" .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      dataGraph: new URL("http://example.org/a.ttl"),
      corsProxyUrl: "http://example.org/proxy?url=",
    }),
  );

  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
  expect(fetchCalls).toContain("http://example.org/b.ttl");
  expect(fetchCalls).not.toContain("http://example.org/proxy?url=http%3A%2F%2Fexample.org%2Fb.ttl");
});

test("sourcePrefixes collects @prefix declarations from both shapesGraph and dataGraph", async () => {
  const environment = await resolveRdfSources(
    rawEnvironment({
      shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> . @prefix ex: <http://example.org/> . ex:PersonShape a sh:NodeShape .`,
      dataGraph: `@prefix ex: <http://example.org/> . @prefix foaf: <http://xmlns.com/foaf/0.1/> . ex:alice a foaf:Person .`,
    }),
  );

  expect(environment.sourcePrefixes).toMatchObject({
    sh: "http://www.w3.org/ns/shacl#",
    ex: "http://example.org/",
    foaf: "http://xmlns.com/foaf/0.1/",
  });
});

test("sourcePrefixes is collected from a URL source, even when cache-hit by a second graph", async () => {
  fixtures["http://example.org/combined.ttl"] = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .
    ex:PersonShape a sh:NodeShape .
    ex:alice a ex:Person .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      shapesGraph: new URL("http://example.org/combined.ttl"),
      dataGraph: new URL("http://example.org/combined.ttl"),
    }),
  );

  expect(environment.sourcePrefixes).toMatchObject({
    sh: "http://www.w3.org/ns/shacl#",
    ex: "http://example.org/",
  });
  expect(fetchCalls.filter((href) => href === "http://example.org/combined.ttl").length).toBe(1);
});

test("sourcePrefixes is empty when every source is already a materialized RdfStore", async () => {
  const environment = await resolveRdfSources(
    rawEnvironment({
      shapesGraph: RdfStore.createDefault(),
      dataGraph: RdfStore.createDefault(),
    }),
  );

  expect(environment.sourcePrefixes).toEqual({});
});

test("a non-404 fetch failure is not remembered as a 404", async () => {
  stubLocalStorage();
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/dead.ttl> .
    ex:a ex:name "A" .
  `;
  // "http://example.org/dead.ttl" is deliberately absent from fixtures, so the default
  // beforeEach fetch stub throws a plain network error for it, not an HTTP 404 response.
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.org/a.ttl") }),
  );

  expect(isKnownNotFound("http://example.org/dead.ttl")).toBe(false);

  warnSpy.mockRestore();
}, 10000);

test("a caller-supplied RdfStore is copied, never mutated by owl:imports merging", async () => {
  fixtures["http://example.org/b.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
  `;
  const callerStore = RdfStore.createDefault();
  callerStore.addQuad(
    factory.quad(ex("a"), owl("imports"), factory.namedNode("http://example.org/b.ttl")),
  );

  const environment = await resolveRdfSources(rawEnvironment({ dataGraph: callerStore }));

  expect(environment.dataGraph).not.toBe(callerStore);
  expect(environment.dataGraph.getQuads(ex("b"), ex("name")).length).toBe(1);
  expect(callerStore.size).toBe(1);
});

test("importedDataGraph records exactly the triples owl:imports added to dataGraph", async () => {
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/b.ttl> .
    ex:a ex:name "A" .
    ex:shared ex:name "Shared" .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
    ex:shared ex:name "Shared" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({ dataGraph: new URL("http://example.org/a.ttl") }),
  );

  // ex:shared is asserted by the data itself too, so it isn't "imported".
  const imported = environment.importedDataGraph!.getQuads().map((quad) => quad.subject.value);
  expect(imported).toEqual([ex("b").value]);
});

test("importedDataGraph leaves out a triple one source imports but another asserts", async () => {
  fixtures["http://example.org/a.ttl"] = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .
    ex:a owl:imports <http://example.org/b.ttl> .
  `;
  fixtures["http://example.org/b.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:b ex:name "B" .
    ex:c ex:name "C" .
  `;
  fixtures["http://example.org/c.ttl"] = `
    @prefix ex: <http://example.org/> .
    ex:c ex:name "C" .
  `;

  const environment = await resolveRdfSources(
    rawEnvironment({
      dataGraph: [new URL("http://example.org/a.ttl"), new URL("http://example.org/c.ttl")],
    }),
  );

  const imported = environment.importedDataGraph!.getQuads().map((quad) => quad.subject.value);
  expect(imported).toEqual([ex("b").value]);
});
