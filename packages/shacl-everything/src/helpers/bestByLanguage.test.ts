import { expect, test } from "vite-plus/test";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { factory } from "@/helpers/factory.ts";

test("bestByLanguage - returns undefined for an empty list", () => {
  expect(bestByLanguage([], ["en"])).toBeUndefined();
});

test("bestByLanguage - returns the only value when none of the values have a language tag", () => {
  const value = factory.namedNode("http://example.com/Alice");
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
  expect(bestByLanguage([en], ["EN"])).toEqual(en);
});

test("bestByLanguage - honors the order of the preferred languages", () => {
  const en = factory.literal("Hello", "en");
  const nl = factory.literal("Hallo", "nl");
  expect(bestByLanguage([en, nl], ["nl", "en"])).toEqual(nl);
  expect(bestByLanguage([en, nl], ["en", "nl"])).toEqual(en);
});

test("bestByLanguage - falls back to a matching primary subtag when there is no exact match", () => {
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([enUS], ["en-GB"])).toEqual(enUS);
});

test("bestByLanguage - prefers an exact match over a primary-subtag-only match", () => {
  const enGB = factory.literal("Colour", "en-GB");
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([enUS, enGB], ["en-GB"])).toEqual(enGB);
});

test("bestByLanguage - prefers a primary-subtag match on an earlier-ranked language over one on a later-ranked language, regardless of value order", () => {
  const deDE = factory.literal("Farbe", "de-DE");
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([deDE, enUS], ["en-GB", "de-CH"])).toEqual(enUS);
});

test("bestByLanguage - an exact match on a lower-ranked language still beats a primary-subtag match on a higher-ranked language", () => {
  const nl = factory.literal("Kleur", "nl");
  const enUS = factory.literal("Color", "en-US");
  expect(bestByLanguage([nl, enUS], ["en-GB", "nl"])).toEqual(nl);
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
