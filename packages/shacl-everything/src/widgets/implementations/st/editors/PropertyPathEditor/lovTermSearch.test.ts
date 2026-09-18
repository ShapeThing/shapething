import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { searchLovProperties } from "./lovTermSearch.ts";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

test("searches LOV by local name when given a prefix:localName CURIE - LOV's own search can't match the colon form at all", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));

  await searchLovProperties("skos:broader");

  const [url] = vi.mocked(fetch).mock.calls[0];
  expect(url.toString()).toContain("q=broader");
  expect(url.toString()).not.toContain("skos");
});

test("ranks a result from the typed CURIE's own vocabulary first", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          { uri: "http://lemon-model.net/lemon#broader", prefixedName: "lemon:broader", vocabulary: { prefix: "lemon" } },
          { uri: "http://www.w3.org/2004/02/skos/core#broader", prefixedName: "skos:broader", vocabulary: { prefix: "skos" } },
        ],
      }),
      { status: 200 },
    ),
  );

  const terms = await searchLovProperties("skos:broader");

  expect(terms.map((term) => term.prefixedName)).toEqual(["skos:broader", "lemon:broader"]);
});

test("keeps every result (doesn't hide them) when the typed prefix matches no vocabulary LOV knows", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        results: [
          { uri: "http://www.w3.org/2000/01/rdf-schema#label", prefixedName: "rdfs:label", vocabulary: { prefix: "rdfs" } },
        ],
      }),
      { status: 200 },
    ),
  );

  // "ex" is this project's own local namespace - not a vocabulary LOV itself knows about.
  const terms = await searchLovProperties("ex:label");

  expect(terms.map((term) => term.prefixedName)).toEqual(["rdfs:label"]);
});
