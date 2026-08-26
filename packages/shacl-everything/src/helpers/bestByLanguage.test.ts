import { expect, test } from "vite-plus/test";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { factory } from "@/helpers/factory.ts";
import type { BCP47 } from "@/types/BCP47.ts";

test("bestByLanguage - returns undefined for an empty list", () => {
  expect(bestByLanguage([], ["en"])).toBeUndefined();
});

test("bestByLanguage - returns the only value when none of the values have a language tag", () => {
  const value = factory.namedNode("http://example.org/Alice");
  expect(bestByLanguage([value], ["en"])).toEqual(value);
});

test("bestByLanguage - returns the first value when values are plain literals without a language", () => {
  const first = factory.literal("1");
  const second = factory.literal("2");
  expect(bestByLanguage([first, second], ["en"])).toEqual(first);
});

test("bestByLanguage - returns the exact language match", () => {
  const en = factory.literal("Hello", "en");
  const nl = factory.literal("Hallo", "nl");
  expect(bestByLanguage([en, nl], ["nl"])).toEqual(nl);
});

test("bestByLanguage - is case-insensitive when matching the exact language", () => {
  const en = factory.literal("Hello", "en");
  // BCP47 only models the canonical lowercase form - "EN" here deliberately deviates to exercise
  // bestByLanguage's own case-insensitive comparison.
  expect(bestByLanguage([en], ["EN" as BCP47])).toEqual(en);
});

test("bestByLanguage - honors the order of the preferred languages", () => {
  const en = factory.literal("Hello", "en");
  const nl = factory.literal("Hallo", "nl");
  expect(bestByLanguage([en, nl], ["nl", "en"])).toEqual(nl);
  expect(bestByLanguage([en, nl], ["en", "nl"])).toEqual(en);
});

test("bestByLanguage - a language-only preference (e.g. 'en') matches a region-qualified tag (e.g. 'en-US') per RFC4647 basic filtering", () => {
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([enUS], ["en"])).toEqual(enUS);
});

test("bestByLanguage - a region-qualified preference does NOT match a different region's tag", () => {
  const enGB = factory.literal("Colour", "en-GB");
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([enGB, enUS], ["en-US"])).toEqual(enUS);
  expect(bestByLanguage([enUS, enGB], ["en-GB"])).toEqual(enGB);
});

test("bestByLanguage - a region-qualified preference also matches a plain, unqualified tag (matching is symmetric - most content only ever carries a plain tag, while a live preference often carries a region)", () => {
  const fr = factory.literal("Bonjour", "fr");
  const en = factory.literal("Hello", "en");
  expect(bestByLanguage([fr, en], ["en-US"])).toEqual(en);
});

test("bestByLanguage - prefers an exact match over a broader prefix match", () => {
  const enGB = factory.literal("Colour", "en-GB");
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([enUS, enGB], ["en-GB"])).toEqual(enGB);
});

test("bestByLanguage - a plain-language preference's regional match wins over a later-ranked preference, regardless of value order", () => {
  const deDE = factory.literal("Farbe", "de-DE");
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([enUS, deDE], ["de", "en"])).toEqual(deDE);
});

test("bestByLanguage - an exact match on a lower-ranked language wins when a higher-ranked language matches nothing at all", () => {
  const nl = factory.literal("Kleur", "nl");
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([nl, enUS], ["en-GB", "nl"])).toEqual(nl);
});

test("bestByLanguage - an empty-string preference matches a language-less literal, ranked by its position in the list", () => {
  const fr = factory.literal("Bonjour", "fr");
  const plain = factory.literal("Plain");
  expect(bestByLanguage([fr, plain], ["", "fr"])).toEqual(plain);
  expect(bestByLanguage([fr, plain], ["fr", ""])).toEqual(fr);
});

test("bestByLanguage - an empty-string preference also matches a non-Literal term (nothing has a language at all)", () => {
  const fr = factory.literal("Bonjour", "fr");
  const iri = factory.namedNode("http://example.org/Alice");
  expect(bestByLanguage([fr, iri], ["", "fr"])).toEqual(iri);
});

test("bestByLanguage - falls back to a language-less literal when no preferred language matches", () => {
  const fr = factory.literal("Bonjour", "fr");
  const plain = factory.literal("Plain");
  expect(bestByLanguage([fr, plain], ["en"])).toEqual(plain);
});

test("bestByLanguage - falls back to the first value when nothing matches and there is no language-less literal", () => {
  const fr = factory.literal("Bonjour", "fr");
  const de = factory.literal("Hallo", "de");
  expect(bestByLanguage([fr, de], ["en"])).toEqual(fr);
});

test("bestByLanguage - treats an empty preferred-languages list as no preference", () => {
  const fr = factory.literal("Bonjour", "fr");
  const plain = factory.literal("Plain");
  expect(bestByLanguage([fr, plain], [])).toEqual(plain);
});
