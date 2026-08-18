import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { distillLanguages, distillInterfaceLanguages } from "@/preprocess/languages.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { ex, sh } from "@/helpers/namespaces.ts";

const rawEnvironment = (overrides: Partial<RawEnvironment>): RawEnvironment => ({
  ...defaultEnvironment,
  shapesGraph: RdfStore.createDefault(),
  dataGraph: RdfStore.createDefault(),
  scoresGraph: RdfStore.createDefault(),
  ...overrides,
});

test("distillLanguages - collects language tags from the data graph", () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Cat", "en")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Kat", "nl")));

  const result = distillLanguages(rawEnvironment({ dataGraph }));

  expect(result.languages).toEqual(["en", "nl"]);
});

test("distillLanguages - collects language tags from the shapes graph too", () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("aShape"), ex("name"), factory.literal("Name", "en")));
  shapesGraph.addQuad(factory.quad(ex("aShape"), ex("name"), factory.literal("Naam", "nl")));

  const result = distillLanguages(rawEnvironment({ shapesGraph }));

  expect(result.languages).toEqual(["en", "nl"]);
});

test("distillLanguages - keeps caller-provided languages first, in order, and appends anything extra found in the data", () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Cat", "en")));
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Kat", "nl")));

  const result = distillLanguages(rawEnvironment({ dataGraph, languages: ["en", "fr"] }));

  expect(result.languages).toEqual(["en", "fr", "nl"]);
});

test("distillLanguages - dedupes case-insensitively without dropping the caller's original casing", () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Cat", "en")));

  const result = distillLanguages(rawEnvironment({ dataGraph, languages: ["EN"] }));

  expect(result.languages).toEqual(["EN"]);
});

test("distillLanguages - merges a bare tag found in the data into a configured tag sharing the same primary subtag, instead of listing both", () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Hendrik", "en")));

  const result = distillLanguages(rawEnvironment({ dataGraph, languages: ["en-GB", "nl-NL"] }));

  // Not ["en-GB", "nl-NL", "en"] - "en"/"en-GB" would be indistinguishable entries in the content
  // language switcher (filterByContentLanguage already matches across them by primary subtag), so
  // the configured regioned tag wins and the bare one found in the data is dropped.
  expect(result.languages).toEqual(["en-GB", "nl-NL"]);
});

test("distillLanguages - falls back to contentLanguage when nothing is language-tagged and none was configured", () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Plain")));

  const result = distillLanguages(rawEnvironment({ dataGraph }));

  expect(result.languages).toEqual(["en-GB"]);
});

test("distillLanguages - falls back to a caller-configured contentLanguage, not just the default", () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Plain")));

  const result = distillLanguages(rawEnvironment({ dataGraph, contentLanguage: "fr-FR" }));

  expect(result.languages).toEqual(["fr-FR"]);
});

test("distillInterfaceLanguages - includes the built-in .ftl locales", () => {
  const result = distillInterfaceLanguages(rawEnvironment({}));

  expect(result.interfaceLanguages).toEqual(["en-GB", "nl-NL"]);
});

test("distillInterfaceLanguages - adds languages found on sh:name/sh:description in the shapes graph", () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("aShape"), sh("name"), factory.literal("Naam", "fy")));
  shapesGraph.addQuad(
    factory.quad(ex("aShape"), sh("description"), factory.literal("Un nom", "fr")),
  );

  const result = distillInterfaceLanguages(rawEnvironment({ shapesGraph }));

  expect(result.interfaceLanguages).toEqual(["en-GB", "nl-NL", "fy", "fr"]);
});

test("distillInterfaceLanguages - merges a bare shapes-graph tag into a .ftl locale sharing the same primary subtag, instead of listing both", () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("aShape"), sh("name"), factory.literal("Name", "en")));
  shapesGraph.addQuad(factory.quad(ex("aShape"), sh("name"), factory.literal("Naam", "nl")));

  const result = distillInterfaceLanguages(rawEnvironment({ shapesGraph }));

  // Not ["en-GB", "nl-NL", "en", "nl"] - "en"/"en-GB" and "nl"/"nl-NL" would be indistinguishable
  // entries in the switcher (resolveLocale/bestByLanguage already fall back across them), so the
  // regioned .ftl tag wins and the bare one is dropped rather than shown twice.
  expect(result.interfaceLanguages).toEqual(["en-GB", "nl-NL"]);
});

test("distillInterfaceLanguages - ignores language-tagged literals on other predicates and in the data graph", () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("aShape"), ex("comment"), factory.literal("Note", "de")));
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), ex("value"), factory.literal("Kat", "nl")));

  const result = distillInterfaceLanguages(rawEnvironment({ shapesGraph, dataGraph }));

  expect(result.interfaceLanguages).toEqual(["en-GB", "nl-NL"]);
});

test("distillInterfaceLanguages - removing a built-in locale via interfaceLocales still allows it back in via sh:name", () => {
  const shapesGraph = RdfStore.createDefault();
  shapesGraph.addQuad(factory.quad(ex("aShape"), sh("name"), factory.literal("Naam", "nl-NL")));

  const result = distillInterfaceLanguages(
    rawEnvironment({ shapesGraph, interfaceLocales: { "nl-NL": null } }),
  );

  expect(result.interfaceLanguages).toEqual(["en-GB", "nl-NL"]);
});
