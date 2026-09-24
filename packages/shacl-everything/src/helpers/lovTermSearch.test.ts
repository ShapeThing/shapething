import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  clearLovVocabularyCache,
  isLovSearchable,
  LOV_MIRROR_URL,
  searchLovProperties,
  searchLovTerms,
} from "./lovTermSearch.ts";

const SKOS_NAMESPACE = "http://www.w3.org/2004/02/skos/core#";
// A trimmed-down stand-in for the mirror's by-prefix/skos/ontology.ttl: the type IRIs LOV files
// actually use for classes/properties, plus one term from another vocabulary (as real LOV files
// that build on other vocabularies also type those).
const SKOS_TURTLE = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <${SKOS_NAMESPACE}> .
skos:Concept a owl:Class ; rdfs:label "Concept"@en .
skos:broader a rdf:Property, owl:ObjectProperty ; rdfs:label "has broader"@en .
skos:broadMatch a rdf:Property .
skos:broaderTransitive a owl:ObjectProperty .
skos:exactMatch a rdf:Property .
skos:definition a owl:AnnotationProperty .
<http://other.org/Thing> a owl:Class .
`;

const FOAF_NAMESPACE = "http://xmlns.com/foaf/0.1/";
const FOAF_TURTLE = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf: <${FOAF_NAMESPACE}> .
foaf:Agent a rdfs:Class, owl:Class .
foaf:age a rdf:Property, owl:DatatypeProperty .
foaf:name a rdf:Property .
`;

type MockVocabulary = { namespace: string; turtle: string };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  clearLovVocabularyCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The mirror's layout: by-prefix/<prefix>/meta.json + by-prefix/<prefix>/ontology.ttl, both
// static files, and GitHub Pages' HTML 404 page for any prefix LOV doesn't know.
function mockMirror(vocabularies: Record<string, MockVocabulary>) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const match = input.toString().match(/by-prefix\/([^/]+)\/(meta\.json|ontology\.ttl)$/);
    const vocabulary = match && vocabularies[match[1]];
    if (!vocabulary) return new Response("<html>Page not found</html>", { status: 404 });
    return match[2] === "meta.json"
      ? new Response(
        JSON.stringify({ prefix: match[1], namespace: vocabulary.namespace, ok: true }),
        { status: 200 },
      )
      : new Response(vocabulary.turtle, { status: 200 });
  });
}

function fetchedUrls(): string[] {
  return vi.mocked(fetch).mock.calls.map(([url]) => url.toString());
}

test("fetches the typed prefix's vocabulary from the mirror and returns the terms whose local name starts with the typed text", async () => {
  mockMirror({ skos: { namespace: SKOS_NAMESPACE, turtle: SKOS_TURTLE } });

  const terms = await searchLovProperties("skos:bro");

  expect(terms).toEqual([
    {
      uri: expect.objectContaining({ termType: "NamedNode", value: `${SKOS_NAMESPACE}broadMatch` }),
      prefixedName: "skos:broadMatch",
      vocabularyPrefix: "skos",
      type: "property",
    },
    {
      uri: expect.objectContaining({ value: `${SKOS_NAMESPACE}broader` }),
      prefixedName: "skos:broader",
      vocabularyPrefix: "skos",
      type: "property",
    },
    {
      uri: expect.objectContaining({ value: `${SKOS_NAMESPACE}broaderTransitive` }),
      prefixedName: "skos:broaderTransitive",
      vocabularyPrefix: "skos",
      type: "property",
    },
  ]);
  expect(fetchedUrls().toSorted()).toEqual([
    `${LOV_MIRROR_URL}by-prefix/skos/meta.json`,
    `${LOV_MIRROR_URL}by-prefix/skos/ontology.ttl`,
  ]);
});

test("matches the typed local text case-insensitively", async () => {
  mockMirror({ skos: { namespace: SKOS_NAMESPACE, turtle: SKOS_TURTLE } });

  const terms = await searchLovProperties("skos:BROADER");

  expect(terms.map((term) => term.prefixedName)).toEqual(["skos:broader", "skos:broaderTransitive"]);
});

test("a bare prefix lists that vocabulary's own terms, leaving out terms it types from other namespaces", async () => {
  mockMirror({ skos: { namespace: SKOS_NAMESPACE, turtle: SKOS_TURTLE } });

  const terms = await searchLovTerms("skos:");

  expect(terms.map((term) => term.prefixedName)).toEqual([
    "skos:Concept",
    "skos:broadMatch",
    "skos:broader",
    "skos:broaderTransitive",
    "skos:definition",
    "skos:exactMatch",
  ]);
});

test("caps the result list at 10 terms", async () => {
  const namespace = "http://example.com/big#";
  const turtle = Array.from(
    { length: 12 },
    (_, index) => `<${namespace}p${String(index).padStart(2, "0")}> a <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> .`,
  ).join("\n");
  mockMirror({ big: { namespace, turtle } });

  const terms = await searchLovTerms("big:p");

  expect(terms).toHaveLength(10);
  expect(terms[0].prefixedName).toBe("big:p00");
  expect(terms[9].prefixedName).toBe("big:p09");
});

test("returns nothing for a query with no prefix, without making any request - the mirror has no cross-vocabulary index to search", async () => {
  mockMirror({ skos: { namespace: SKOS_NAMESPACE, turtle: SKOS_TURTLE } });

  expect(await searchLovProperties("broader")).toEqual([]);
  expect(await searchLovProperties("has broader")).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();

  expect(isLovSearchable("broader")).toBe(false);
  expect(isLovSearchable("skos:bro")).toBe(true);
  expect(isLovSearchable("skos:")).toBe(true);
});

test("treats a full IRI being typed, or text before the colon that can't be a prefix, as not a CURIE", async () => {
  mockMirror({});

  expect(await searchLovTerms("http://www.w3.org/2004/02/skos/core#bro")).toEqual([]);
  expect(await searchLovTerms("my prefix:foo")).toEqual([]);
  expect(await searchLovTerms(":foo")).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
  expect(isLovSearchable("http://www.w3.org/2004/02/skos/core#bro")).toBe(false);
});

test("fetches a prefix with Turtle-legal punctuation under exactly that folder name", async () => {
  mockMirror({ "dbpedia-owl": { namespace: "http://dbpedia.org/ontology/", turtle: "" } });

  await searchLovTerms("dbpedia-owl:Pe");

  expect(fetchedUrls()).toContain(`${LOV_MIRROR_URL}by-prefix/dbpedia-owl/ontology.ttl`);
});

test("returns nothing (rather than throwing) for a prefix the mirror doesn't know, and asks only once per prefix", async () => {
  mockMirror({});

  expect(await searchLovProperties("zzz:foo")).toEqual([]);
  expect(await searchLovProperties("zzz:foobar")).toEqual([]);

  expect(fetch).toHaveBeenCalledTimes(2);
});

test("throws on a non-404 failure instead of silently returning nothing", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("Service Unavailable", { status: 503 }));

  await expect(searchLovProperties("skos:bro")).rejects.toThrow("LOV mirror request failed: 503");
});

test("loads a vocabulary once and re-searches it in memory for later queries with the same prefix", async () => {
  mockMirror({ skos: { namespace: SKOS_NAMESPACE, turtle: SKOS_TURTLE } });

  await searchLovProperties("skos:b");
  await searchLovProperties("skos:br");
  const terms = await searchLovProperties("skos:bro");

  expect(terms).toHaveLength(3);
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("retries a vocabulary whose load failed, rather than remembering the failure", async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await expect(searchLovProperties("skos:bro")).rejects.toThrow("Failed to fetch");

  mockMirror({ skos: { namespace: SKOS_NAMESPACE, turtle: SKOS_TURTLE } });
  const terms = await searchLovProperties("skos:bro");

  expect(terms).toHaveLength(3);
  expect(fetch).toHaveBeenCalledTimes(4);
});

test("searchLovTerms reports both classes and properties, each tagged with its own kind, when no types are given", async () => {
  mockMirror({ foaf: { namespace: FOAF_NAMESPACE, turtle: FOAF_TURTLE } });

  const terms = await searchLovTerms("foaf:a");

  expect(terms).toEqual([
    {
      uri: expect.objectContaining({ value: `${FOAF_NAMESPACE}Agent` }),
      prefixedName: "foaf:Agent",
      vocabularyPrefix: "foaf",
      type: "class",
    },
    {
      uri: expect.objectContaining({ value: `${FOAF_NAMESPACE}age` }),
      prefixedName: "foaf:age",
      vocabularyPrefix: "foaf",
      type: "property",
    },
  ]);
});

test("searchLovTerms restricts to the requested kind only", async () => {
  mockMirror({ foaf: { namespace: FOAF_NAMESPACE, turtle: FOAF_TURTLE } });

  expect((await searchLovTerms("foaf:a", ["class"])).map((term) => term.prefixedName)).toEqual([
    "foaf:Agent",
  ]);
  expect((await searchLovProperties("foaf:a")).map((term) => term.prefixedName)).toEqual([
    "foaf:age",
  ]);
});
