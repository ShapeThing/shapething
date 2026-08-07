import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { distillLanguages } from "@/preprocess/languages.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";

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

test("distillLanguages - is empty when nothing is language-tagged and none was configured", () => {
  const dataGraph = RdfStore.createDefault();
  dataGraph.addQuad(factory.quad(ex("a"), ex("name"), factory.literal("Plain")));

  const result = distillLanguages(rawEnvironment({ dataGraph }));

  expect(result.languages).toEqual([]);
});
