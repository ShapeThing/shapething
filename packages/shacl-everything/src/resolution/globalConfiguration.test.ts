import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { getLabelPreference, getLanguagePreference } from "@/resolution/globalConfiguration.ts";

const graph = (turtle: string) => parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");

test("getLanguagePreference returns [] when no shui:Configuration/sh:Graph subject exists", async () => {
  const shapesGraph = await graph(`ex:someShape a sh:NodeShape .`);
  expect(getLanguagePreference(shapesGraph)).toEqual([]);
});

test("getLanguagePreference reads an ordered list off a shui:Configuration instance, including a leading empty-string entry", async () => {
  const shapesGraph = await graph(
    `ex:config a shui:Configuration ; shui:languagePreference ( "" "en" "de" ) .`,
  );
  expect(getLanguagePreference(shapesGraph)).toEqual(["", "en", "de"]);
});

test("getLanguagePreference also recognizes a sh:Graph-typed subject, not just shui:Configuration", async () => {
  const shapesGraph = await graph(`ex:config a sh:Graph ; shui:languagePreference ( "fr" "en" ) .`);
  expect(getLanguagePreference(shapesGraph)).toEqual(["fr", "en"]);
});

test("getLanguagePreference returns [] when the configuration subject has no shui:languagePreference", async () => {
  const shapesGraph = await graph(`ex:config a shui:Configuration .`);
  expect(getLanguagePreference(shapesGraph)).toEqual([]);
});

test("getLabelPreference returns [] when unconfigured", async () => {
  const shapesGraph = await graph(`ex:someShape a sh:NodeShape .`);
  expect(getLabelPreference(shapesGraph)).toEqual([]);
});

test("getLabelPreference reads an ordered list of simple predicate paths", async () => {
  const shapesGraph = await graph(
    `ex:config a shui:Configuration ; shui:labelPreference ( skos:prefLabel dcterms:title rdfs:label ) .`,
  );
  expect(getLabelPreference(shapesGraph)).toEqual([
    { type: "predicate", predicate: expect.objectContaining({ value: skosPrefLabel }) },
    { type: "predicate", predicate: expect.objectContaining({ value: dctermsTitle }) },
    { type: "predicate", predicate: expect.objectContaining({ value: rdfsLabel }) },
  ]);
});

test("getLabelPreference parses a complex path member via the same path-expression logic as sh:path", async () => {
  const shapesGraph = await graph(
    `ex:config a shui:Configuration ; shui:labelPreference ( [ sh:inversePath ex:childOf ] ) .`,
  );
  expect(getLabelPreference(shapesGraph)).toEqual([
    {
      type: "inverse",
      path: {
        type: "predicate",
        predicate: expect.objectContaining({ value: ex("childOf").value }),
      },
    },
  ]);
});

const skosPrefLabel = "http://www.w3.org/2004/02/skos/core#prefLabel";
const dctermsTitle = "http://purl.org/dc/terms/title";
const rdfsLabel = "http://www.w3.org/2000/01/rdf-schema#label";
