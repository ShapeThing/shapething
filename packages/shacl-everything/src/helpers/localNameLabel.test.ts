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
