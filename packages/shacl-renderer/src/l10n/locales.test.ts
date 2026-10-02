import { expect, test } from "vite-plus/test";
import {
  builtInLocaleLoaders,
  DEFAULT_LOCALE,
  mergeLocaleLoaders,
  resolveLocale,
  type LocaleLoader,
} from "@/l10n/locales.ts";

const loader: LocaleLoader = () => Promise.resolve("hello = Hello");

test("builtInLocaleLoaders - ships en-GB and nl-NL, inlined (no fetch needed)", async () => {
  expect(Object.keys(builtInLocaleLoaders).sort()).toEqual(["en-GB", "nl-NL"]);
  expect(DEFAULT_LOCALE).toEqual("en-GB");
  expect(await builtInLocaleLoaders["en-GB"]!()).toContain("node-ui-submit-create = Create");
  expect(await builtInLocaleLoaders["nl-NL"]!()).toContain("node-ui-submit-create = Aanmaken");
});

test("resolveLocale - an exact match wins", () => {
  expect(resolveLocale("nl-NL", { "nl-BE": loader, "nl-NL": loader })).toEqual("nl-NL");
});

test("resolveLocale - falls back to a locale sharing the primary subtag", () => {
  expect(resolveLocale("nl", { "en-GB": loader, "nl-NL": loader })).toEqual("nl-NL");
  expect(resolveLocale("nl-BE", { "en-GB": loader, "nl-NL": loader })).toEqual("nl-NL");
});

test("resolveLocale - primary subtag matching is case-insensitive", () => {
  expect(resolveLocale("NL", { "nl-NL": loader })).toEqual("nl-NL");
});

test("resolveLocale - prefers the exact match over an earlier same-primary-subtag entry", () => {
  expect(resolveLocale("en-US", { "en-GB": loader, "en-US": loader })).toEqual("en-US");
});

test("resolveLocale - returns undefined when nothing shares the primary subtag", () => {
  expect(resolveLocale("fr-FR", { "en-GB": loader, "nl-NL": loader })).toBeUndefined();
});

test("mergeLocaleLoaders - with no overrides, returns the built-ins", () => {
  expect(mergeLocaleLoaders()).toEqual(builtInLocaleLoaders);
});

test("mergeLocaleLoaders - adds a new locale alongside the built-ins", () => {
  const merged = mergeLocaleLoaders({ "fr-FR": loader });
  expect(Object.keys(merged).sort()).toEqual(["en-GB", "fr-FR", "nl-NL"]);
  expect(merged["fr-FR"]).toBe(loader);
});

test("mergeLocaleLoaders - overrides a built-in locale with the caller's loader", () => {
  const merged = mergeLocaleLoaders({ "nl-NL": loader });
  expect(merged["nl-NL"]).toBe(loader);
  expect(merged["en-GB"]).toBe(builtInLocaleLoaders["en-GB"]);
});

test("mergeLocaleLoaders - null removes a built-in locale entirely", () => {
  const merged = mergeLocaleLoaders({ "nl-NL": null });
  expect(Object.keys(merged)).toEqual(["en-GB"]);
  expect("nl-NL" in merged).toBe(false);
});

test("mergeLocaleLoaders - does not mutate the built-ins", () => {
  mergeLocaleLoaders({ "nl-NL": null, "en-GB": loader });
  expect(Object.keys(builtInLocaleLoaders).sort()).toEqual(["en-GB", "nl-NL"]);
  expect(builtInLocaleLoaders["en-GB"]).not.toBe(loader);
});
