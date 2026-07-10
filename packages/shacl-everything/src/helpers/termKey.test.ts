import { expect, test } from "vite-plus/test";
import { termKey } from "@/helpers/termKey.ts";
import { factory } from "@/helpers/factory.ts";
import { xsd } from "@/helpers/namespaces.ts";

test("termKey - named nodes with the same IRI produce the same key", () => {
  const a = factory.namedNode("http://example.com/Alice");
  const b = factory.namedNode("http://example.com/Alice");
  expect(termKey(a)).toEqual(termKey(b));
});

test("termKey - named nodes with different IRIs produce different keys", () => {
  const a = factory.namedNode("http://example.com/Alice");
  const b = factory.namedNode("http://example.com/Bob");
  expect(termKey(a)).not.toEqual(termKey(b));
});

test("termKey - blank nodes with the same label produce the same key", () => {
  const a = factory.blankNode("b0");
  const b = factory.blankNode("b0");
  expect(termKey(a)).toEqual(termKey(b));
});

test("termKey - a named node and a blank node with the same value produce different keys", () => {
  const namedNode = factory.namedNode("b0");
  const blankNode = factory.blankNode("b0");
  expect(termKey(namedNode)).not.toEqual(termKey(blankNode));
});

test("termKey - literals with the same value, datatype and language produce the same key", () => {
  const a = factory.literal("Alice", "en");
  const b = factory.literal("Alice", "en");
  expect(termKey(a)).toEqual(termKey(b));
});

test("termKey - literals differing only by language produce different keys", () => {
  const en = factory.literal("Alice", "en");
  const nl = factory.literal("Alice", "nl");
  expect(termKey(en)).not.toEqual(termKey(nl));
});

test("termKey - literals differing only by datatype produce different keys", () => {
  const string = factory.literal("1", xsd("string"));
  const integer = factory.literal("1", xsd("integer"));
  expect(termKey(string)).not.toEqual(termKey(integer));
});

test("termKey - a literal and a named node with the same value produce different keys", () => {
  const literal = factory.literal("http://example.com/Alice");
  const namedNode = factory.namedNode("http://example.com/Alice");
  expect(termKey(literal)).not.toEqual(termKey(namedNode));
});
