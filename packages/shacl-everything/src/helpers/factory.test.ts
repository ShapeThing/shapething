import { expect, test } from "vite-plus/test";
import { DataFactory } from "rdf-data-factory";
import { factory } from "@/helpers/factory.ts";

test("factory - is a shared rdf-data-factory instance", () => {
  expect(factory).toBeInstanceOf(DataFactory);
});

test("factory - produces the expected term types", () => {
  expect(factory.namedNode("http://example.com/Alice").termType).toEqual("NamedNode");
  expect(factory.blankNode("b0").termType).toEqual("BlankNode");
  expect(factory.literal("Alice").termType).toEqual("Literal");
});
