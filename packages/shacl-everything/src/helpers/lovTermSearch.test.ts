import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { searchLovProperties, searchLovTerms } from "./lovTermSearch.ts";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sparqlResults(bindings: Record<string, { value: string }>[]) {
  return JSON.stringify({ head: { vars: [] }, results: { bindings } });
}

// A CURIE query first calls LOV's SPARQL endpoint (namespace resolution, then a prefix-scoped
// term search) before ever falling back to term/search - these tests mock fetch by URL so each
// of the (up to three) calls a given scenario makes gets the right shaped response.
function mockLovFetch(handlers: {
  resolveNamespace?: () => Response;
  prefixSearch?: () => Response;
  termSearch?: () => Response;
}) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = input.toString();
    if (url.includes("dataset/sparql")) {
      const query = decodeURIComponent(new URL(url).searchParams.get("query") ?? "");
      if (query.includes("vann:preferredNamespacePrefix")) {
        return (handlers.resolveNamespace ?? (() => new Response(sparqlResults([]), { status: 200 })))();
      }
      return (handlers.prefixSearch ?? (() => new Response(sparqlResults([]), { status: 200 })))();
    }
    return (handlers.termSearch ?? (() => new Response(JSON.stringify({ results: [] }), { status: 200 })))();
  });
}

test("maps a LOV search response into LovTerm[]", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          {
            type: "property",
            uri: "http://www.w3.org/2000/01/rdf-schema#label",
            prefixedName: "rdfs:label",
            vocabulary: { prefix: "rdfs" },
            score: 63.45,
          },
        ],
      }),
      { status: 200 },
    ),
  );

  const terms = await searchLovProperties("label");

  expect(terms).toEqual([
    {
      uri: expect.objectContaining({
        termType: "NamedNode",
        value: "http://www.w3.org/2000/01/rdf-schema#label",
      }),
      prefixedName: "rdfs:label",
      vocabularyPrefix: "rdfs",
      type: "property",
    },
  ]);

  const [url] = vi.mocked(fetch).mock.calls[0];
  expect(url.toString()).toBe(
    "https://lov.linkeddata.es/dataset/api/v2/term/search?type=property&page_size=10&q=label",
  );
});

test("returns an empty list when the response has no results", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

  expect(await searchLovProperties("nonexistent")).toEqual([]);
});

test("throws on a non-ok response instead of silently returning nothing", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("Service Unavailable", { status: 503 }));

  await expect(searchLovProperties("label")).rejects.toThrow("LOV term search failed: 503");
});

test("URL-encodes the query", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));

  await searchLovProperties("has part");

  const [url] = vi.mocked(fetch).mock.calls[0];
  expect(url.toString()).toContain("q=has%20part");
});

test("resolves a known CURIE prefix via LOV's SPARQL endpoint and returns true prefix matches, without ever calling term/search", async () => {
  mockLovFetch({
    resolveNamespace: () =>
      new Response(sparqlResults([{ ns: { value: "http://www.w3.org/2004/02/skos/core#" } }]), {
        status: 200,
      }),
    prefixSearch: () =>
      new Response(
        sparqlResults([
          { prop: { value: "http://www.w3.org/2004/02/skos/core#broader" }, kind: { value: "property" } },
          { prop: { value: "http://www.w3.org/2004/02/skos/core#broadMatch" }, kind: { value: "property" } },
        ]),
        { status: 200 },
      ),
  });

  const terms = await searchLovProperties("skos:bro");

  expect(terms).toEqual([
    {
      uri: expect.objectContaining({ value: "http://www.w3.org/2004/02/skos/core#broader" }),
      prefixedName: "skos:broader",
      vocabularyPrefix: "skos",
      type: "property",
    },
    {
      uri: expect.objectContaining({ value: "http://www.w3.org/2004/02/skos/core#broadMatch" }),
      prefixedName: "skos:broadMatch",
      vocabularyPrefix: "skos",
      type: "property",
    },
  ]);

  expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
  for (const [url] of vi.mocked(fetch).mock.calls) {
    expect(url.toString()).not.toContain("term/search");
  }
});

test("falls back to term/search when the resolved vocabulary has no term starting with the typed text", async () => {
  mockLovFetch({
    resolveNamespace: () =>
      new Response(sparqlResults([{ ns: { value: "http://www.w3.org/2004/02/skos/core#" } }]), {
        status: 200,
      }),
    prefixSearch: () => new Response(sparqlResults([]), { status: 200 }),
    termSearch: () =>
      new Response(
        JSON.stringify({
          results: [
            {
              uri: "http://www.w3.org/2004/02/skos/core#exactMatch",
              prefixedName: "skos:exactMatch",
              vocabulary: { prefix: "skos" },
            },
          ],
        }),
        { status: 200 },
      ),
  });

  const terms = await searchLovProperties("skos:zzz");

  expect(terms.map((term) => term.prefixedName)).toEqual(["skos:exactMatch"]);
  expect(vi.mocked(fetch).mock.calls).toHaveLength(3);
  const [termSearchUrl] = vi.mocked(fetch).mock.calls[2];
  expect(termSearchUrl.toString()).toContain("q=zzz");
});

test("falls back to term/search when LOV's SPARQL endpoint itself fails", async () => {
  mockLovFetch({
    resolveNamespace: () => new Response("Service Unavailable", { status: 503 }),
    termSearch: () =>
      new Response(
        JSON.stringify({
          results: [
            {
              uri: "http://www.w3.org/2004/02/skos/core#broader",
              prefixedName: "skos:broader",
              vocabulary: { prefix: "skos" },
            },
          ],
        }),
        { status: 200 },
      ),
  });

  const terms = await searchLovProperties("skos:broader");

  expect(terms.map((term) => term.prefixedName)).toEqual(["skos:broader"]);
});

test("escapes a double quote in the typed local text instead of corrupting the SPARQL query", async () => {
  mockLovFetch({
    resolveNamespace: () =>
      new Response(sparqlResults([{ ns: { value: "http://www.w3.org/2004/02/skos/core#" } }]), {
        status: 200,
      }),
  });

  await searchLovProperties('skos:bro"ader');

  const prefixSearchCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => {
      const query = decodeURIComponent(new URL(url.toString()).searchParams.get("query") ?? "");
      return query.includes("STRSTARTS");
    });
  expect(prefixSearchCall).toBeDefined();
  const query = decodeURIComponent(
    new URL(prefixSearchCall![0].toString()).searchParams.get("query") ?? "",
  );
  expect(query).toContain('bro\\"ader');
});

test("searches LOV by local name when given a prefix:localName CURIE that LOV's SPARQL endpoint can't resolve - LOV's own search can't match the colon form at all", async () => {
  mockLovFetch({});

  await searchLovProperties("skos:broader");

  const termSearchCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => url.toString().includes("term/search"));
  expect(termSearchCall).toBeDefined();
  expect(termSearchCall![0].toString()).toContain("q=broader");
  expect(termSearchCall![0].toString()).not.toContain("skos");
});

test("ranks a term/search result from the typed CURIE's own vocabulary first, when the SPARQL prefix search itself found nothing", async () => {
  mockLovFetch({
    termSearch: () =>
      new Response(
        JSON.stringify({
          results: [
            { uri: "http://lemon-model.net/lemon#broader", prefixedName: "lemon:broader", vocabulary: { prefix: "lemon" } },
            { uri: "http://www.w3.org/2004/02/skos/core#broader", prefixedName: "skos:broader", vocabulary: { prefix: "skos" } },
          ],
        }),
        { status: 200 },
      ),
  });

  const terms = await searchLovProperties("skos:broader");

  expect(terms.map((term) => term.prefixedName)).toEqual(["skos:broader", "lemon:broader"]);
});

test("keeps every term/search result (doesn't hide them) when the typed prefix matches no vocabulary LOV knows", async () => {
  mockLovFetch({
    termSearch: () =>
      new Response(
        JSON.stringify({
          results: [
            { uri: "http://www.w3.org/2000/01/rdf-schema#label", prefixedName: "rdfs:label", vocabulary: { prefix: "rdfs" } },
          ],
        }),
        { status: 200 },
      ),
  });

  // "ex" is this project's own local namespace - not a vocabulary LOV itself knows about.
  const terms = await searchLovProperties("ex:label");

  expect(terms.map((term) => term.prefixedName)).toEqual(["rdfs:label"]);
});

test("searchLovTerms omits the type filter (searches both classes and properties) when no types are given", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          { type: "class", uri: "http://xmlns.com/foaf/0.1/Agent", prefixedName: "foaf:Agent", vocabulary: { prefix: "foaf" } },
          { type: "property", uri: "http://xmlns.com/foaf/0.1/name", prefixedName: "foaf:name", vocabulary: { prefix: "foaf" } },
        ],
      }),
      { status: 200 },
    ),
  );

  const terms = await searchLovTerms("agent");

  expect(terms.map((term) => term.type)).toEqual(["class", "property"]);
  const [url] = vi.mocked(fetch).mock.calls[0];
  expect(url.toString()).not.toContain("type=");
});

test("searchLovTerms passes a single requested type straight through as term/search's own type filter", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));

  await searchLovTerms("agent", ["class"]);

  const [url] = vi.mocked(fetch).mock.calls[0];
  expect(url.toString()).toContain("type=class");
});

test("searchLovTerms' SPARQL prefix search unions class and property type IRIs and tags each match's kind", async () => {
  mockLovFetch({
    resolveNamespace: () =>
      new Response(sparqlResults([{ ns: { value: "http://xmlns.com/foaf/0.1/" } }]), { status: 200 }),
    prefixSearch: () =>
      new Response(
        sparqlResults([
          { prop: { value: "http://xmlns.com/foaf/0.1/Agent" }, kind: { value: "class" } },
          { prop: { value: "http://xmlns.com/foaf/0.1/age" }, kind: { value: "property" } },
        ]),
        { status: 200 },
      ),
  });

  const terms = await searchLovTerms("foaf:ag");

  expect(terms).toEqual([
    {
      uri: expect.objectContaining({ value: "http://xmlns.com/foaf/0.1/Agent" }),
      prefixedName: "foaf:Agent",
      vocabularyPrefix: "foaf",
      type: "class",
    },
    {
      uri: expect.objectContaining({ value: "http://xmlns.com/foaf/0.1/age" }),
      prefixedName: "foaf:age",
      vocabularyPrefix: "foaf",
      type: "property",
    },
  ]);

  const [, prefixSearchCall] = vi.mocked(fetch).mock.calls;
  const query = decodeURIComponent(new URL(prefixSearchCall[0].toString()).searchParams.get("query") ?? "");
  expect(query).toContain("UNION");
  expect(query).toContain("rdfs:Class");
  expect(query).toContain("rdf:Property");
});
