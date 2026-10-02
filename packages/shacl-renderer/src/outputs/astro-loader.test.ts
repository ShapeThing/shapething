import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";
import { astroLoader } from "@/outputs/astro-loader.ts";

test("loads one entry per shape target and writes a zod schema", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "astro-loader-"));
  await writeFile(
    path.join(root, "shape.ttl"),
    `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

      <> a sh:NodeShape ;
        sh:name "Ontology property"@en ;
        sh:targetClass rdf:Property ;
        sh:property [ sh:path rdfs:label ; sh:datatype rdf:langString ; sh:minCount 1 ] .
    `,
  );
  await writeFile(
    path.join(root, "data.ttl"),
    `
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix ex: <http://example.org/> .

      ex:name a rdf:Property ; rdfs:label "Name"@en, "Naam"@nl .
      ex:Person a rdfs:Class .
    `,
  );

  const entries: { id: string; data: Record<string, unknown> }[] = [];
  await astroLoader({
    shapes: "shape.ttl",
    data: "*.ttl",
    languages: ["nl"],
    schemaFile: "schema/property.ts",
  }).load({
    config: { root: pathToFileURL(`${root}/`) },
    store: { clear: () => entries.splice(0), set: (entry) => !!entries.push(entry) },
    generateDigest: () => "digest",
  });

  expect(entries).toEqual([{ id: "http://example.org/name", data: { label: "Naam" }, digest: "digest" }]);
  const schema = await readFile(path.join(root, "schema/property.ts"), "utf8");
  expect(schema).toContain(`import { z } from "astro:content";`);
  expect(schema).toContain("export const OntologyPropertySchema = z.object({");
  expect(schema).toContain("label: z.string()");
});
