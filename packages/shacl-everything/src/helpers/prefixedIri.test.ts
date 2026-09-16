import { expect, test } from "vite-plus/test";
import { prefixedIri } from "@/helpers/prefixedIri.ts";
import { factory } from "@/helpers/factory.ts";

test("prefixedIri - shrinks a known-namespace IRI to prefix:localName", () => {
  expect(prefixedIri(factory.namedNode("http://purl.org/dc/elements/1.1/title"))).toEqual(
    "dc:title",
  );
  expect(prefixedIri(factory.namedNode("http://www.w3.org/2000/01/rdf-schema#label"))).toEqual(
    "rdfs:label",
  );
});

test("prefixedIri - undefined for an IRI with no known prefix", () => {
  expect(prefixedIri(factory.namedNode("http://totally-unknown.example/thing"))).toBeUndefined();
});

test("prefixedIri - undefined for a bare namespace IRI with nothing left over for a local name", () => {
  expect(prefixedIri(factory.namedNode("http://purl.org/dc/elements/1.1/"))).toBeUndefined();
});

test("prefixedIri - prefers the most specific (longest) matching namespace", () => {
  expect(prefixedIri(factory.namedNode("http://purl.org/dc/terms/title"))).toEqual("dcterms:title");
});
