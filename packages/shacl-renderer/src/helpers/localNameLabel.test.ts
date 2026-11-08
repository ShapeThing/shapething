import { expect, test } from "vite-plus/test";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import { factory } from "@/helpers/factory.ts";

test("localNameLabel - returns null when given no term", () => {
  expect(localNameLabel(undefined)).toBeNull();
});

test("localNameLabel - returns null for a blank node", () => {
  expect(localNameLabel(factory.blankNode("b0"))).toBeNull();
});

test("localNameLabel - humanizes the IRI's local name", () => {
  expect(localNameLabel(factory.namedNode("http://example.org/ontology#GivenName"))).toEqual(
    "Given Name",
  );
});

test("localNameLabel - returns null for a namespace IRI with an empty local name (e.g. skos:)", () => {
  expect(localNameLabel(factory.namedNode("http://www.w3.org/2004/02/skos/core#"))).toBeNull();
  expect(localNameLabel(factory.namedNode("http://schema.org/"))).toBeNull();
});

test("localNameLabel - returns null for a scheme + authority-only IRI instead of humanizing the host", () => {
  expect(localNameLabel(factory.namedNode("http://www.wittgen.cam.ac.uk"))).toBeNull();
  expect(localNameLabel(factory.namedNode("https://example.org:8080"))).toBeNull();
  expect(localNameLabel(factory.namedNode("https://example.org?page=1"))).toBeNull();
});

test("localNameLabel - still uses a fragment on an authority-only IRI", () => {
  expect(localNameLabel(factory.namedNode("http://example.org#GivenName"))).toEqual("Given Name");
});
