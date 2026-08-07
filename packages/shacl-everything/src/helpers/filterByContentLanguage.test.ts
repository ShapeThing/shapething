import { expect, test } from "vite-plus/test";
import { filterByContentLanguage } from "@/helpers/filterByContentLanguage.ts";
import { factory } from "@/helpers/factory.ts";
import type { BCP47 } from "@/types/BCP47.ts";

test("filterByContentLanguage - keeps only the literal matching the active language", () => {
  const en = factory.literal("Cat", "en");
  const nl = factory.literal("Kat", "nl");

  expect(filterByContentLanguage([en, nl], "nl")).toEqual([nl]);
});

test("filterByContentLanguage - matches by primary subtag", () => {
  const enGB = factory.literal("Colour", "en-GB");
  const enUS = factory.literal("Color", "en-US");

  expect(filterByContentLanguage([enGB, enUS], "en")).toEqual([enGB, enUS]);
});

test("filterByContentLanguage - is case-insensitive", () => {
  const en = factory.literal("Cat", "en");

  expect(filterByContentLanguage([en], "EN" as BCP47)).toEqual([en]);
});

test("filterByContentLanguage - always keeps language-less literals", () => {
  const plain = factory.literal("42");
  const nl = factory.literal("Kat", "nl");

  expect(filterByContentLanguage([plain, nl], "en")).toEqual([plain]);
});

test("filterByContentLanguage - always keeps non-literal terms", () => {
  const iri = factory.namedNode("http://example.com/a");
  const nl = factory.literal("Kat", "nl");

  expect(filterByContentLanguage([iri, nl], "en")).toEqual([iri]);
});
