import { expect, test } from "vite-plus/test";
import { prefixedIri } from "@/helpers/prefixedIri.tsx";
import { factory } from "@/helpers/factory.ts";

test("prefixedIri - shrinks a known-namespace IRI to prefix:localName", () => {
  expect(
    prefixedIri(factory.namedNode("http://purl.org/dc/elements/1.1/title")),
  ).toEqual(
    "dc:title",
  );
  expect(
    prefixedIri(
      factory.namedNode("http://www.w3.org/2000/01/rdf-schema#label"),
    ),
  ).toEqual(
    "rdfs:label",
  );
});

test("prefixedIri - undefined for an IRI with no known prefix", () => {
  expect(prefixedIri(factory.namedNode("http://totally-unknown.example/thing")))
    .toBeUndefined();
});

test("prefixedIri - undefined for a bare namespace IRI with nothing left over for a local name", () => {
  expect(prefixedIri(factory.namedNode("http://purl.org/dc/elements/1.1/")))
    .toBeUndefined();
});

test("prefixedIri - prefers the most specific (longest) matching namespace", () => {
  expect(prefixedIri(factory.namedNode("http://purl.org/dc/terms/title")))
    .toEqual("dcterms:title");
});

test("prefixedIri - a sourcePrefixes alias for a brand new namespace is used", () => {
  expect(
    prefixedIri(factory.namedNode("http://example.com/vocab#Widget"), {
      myvocab: "http://example.com/vocab#",
    }),
  ).toEqual("myvocab:Widget");
});

test("prefixedIri - a sourcePrefixes alias for an already-known namespace wins over the built-in one", () => {
  expect(
    prefixedIri(factory.namedNode("http://schema.org/name"), {
      schema1: "http://schema.org/",
    }),
  ).toEqual("schema1:name");
});

test("prefixedIri - a sourcePrefixes entry reusing a built-in alias for a different namespace doesn't clobber it", () => {
  const sourcePrefixes = { ex: "http://mycompany.example/" };
  expect(
    prefixedIri(
      factory.namedNode("http://mycompany.example/thing"),
      sourcePrefixes,
    ),
  ).toEqual(
    "ex:thing",
  );
  expect(
    prefixedIri(factory.namedNode("http://example.org/thing"), sourcePrefixes),
  ).toEqual(
    "ex:thing",
  );
});
