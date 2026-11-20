import { expect, test } from "vitest";
import { compactIri, iriToSegment, segmentToIri } from "./prefixes.ts";

const prefixes = {
  "": "https://data.norg.nl/def/begrippenkader#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  dcat: "http://www.w3.org/ns/dcat#",
  shapes: "https://example.org/shapes/",
  deep: "https://example.org/shapes/deep/",
};

test("compacts with the longest matching namespace", () => {
  expect(compactIri("http://www.w3.org/2004/02/skos/core#Concept", prefixes)).toBe("skos:Concept");
  expect(compactIri("https://example.org/shapes/deep/X", prefixes)).toBe("deep:X");
  expect(compactIri("https://data.norg.nl/def/begrippenkader#ConceptShape", prefixes)).toBe(
    ":ConceptShape",
  );
  // A local part with a slash would not read back as the same IRI.
  expect(compactIri("https://example.org/shapes/a/b", prefixes)).toBeUndefined();
  expect(compactIri("https://unknown.org/X", prefixes)).toBeUndefined();
});

test("segments round-trip, prefixed or not", () => {
  for (const iri of [
    "http://www.w3.org/2004/02/skos/core#Concept",
    "https://data.norg.nl/def/begrippenkader#ConceptShape",
    "https://unknown.org/path/X#y",
  ]) {
    const segment = decodeURIComponent(iriToSegment(iri, prefixes));
    expect(segmentToIri(segment, prefixes).value).toBe(iri);
  }
  expect(iriToSegment("http://www.w3.org/2004/02/skos/core#Concept", prefixes)).toBe(
    "skos:Concept",
  );
});

test("an unknown prefix is taken as written", () => {
  expect(segmentToIri("nope:X", prefixes).value).toBe("nope:X");
});
