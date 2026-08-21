import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { deleteLiteralsByLanguage } from "@/helpers/deleteLiteralsByLanguage.ts";
import { factory } from "@/helpers/factory.ts";
import type { BCP47 } from "@/types/BCP47.ts";

const subject = factory.namedNode("http://example.org/data");
const predicate = factory.namedNode("http://example.org/label");

function storeOf(...literals: string[][]): RdfStore {
  const store = RdfStore.createDefault();
  for (const [value, language] of literals) {
    store.addQuad(factory.quad(subject, predicate, factory.literal(value, language)));
  }
  return store;
}

test("deleteLiteralsByLanguage - removes every literal tagged with the given language", () => {
  const store = storeOf(["Cat", "en"], ["Kat", "nl"]);

  deleteLiteralsByLanguage(store, "nl");

  expect(store.getQuads().map((quad) => quad.object.value)).toEqual(["Cat"]);
});

test("deleteLiteralsByLanguage - matches exactly, not by primary subtag", () => {
  const store = storeOf(["Colour", "en-GB"], ["Color", "en-US"]);

  deleteLiteralsByLanguage(store, "en-GB");

  expect(store.getQuads().map((quad) => quad.object.value)).toEqual(["Color"]);
});

test("deleteLiteralsByLanguage - is case-insensitive", () => {
  const store = storeOf(["Cat", "en"]);

  deleteLiteralsByLanguage(store, "EN" as BCP47);

  expect(store.getQuads()).toEqual([]);
});

test("deleteLiteralsByLanguage - leaves language-less literals and non-literal terms untouched", () => {
  const store = RdfStore.createDefault();
  const plain = factory.quad(subject, predicate, factory.literal("42"));
  const iri = factory.quad(subject, predicate, factory.namedNode("http://example.org/a"));
  const nl = factory.quad(subject, predicate, factory.literal("Kat", "nl"));
  store.addQuad(plain);
  store.addQuad(iri);
  store.addQuad(nl);

  deleteLiteralsByLanguage(store, "nl");

  expect(store.getQuads()).toEqual([plain, iri]);
});
