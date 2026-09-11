import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import { detectPatterns } from "@/analysis/patterns.ts";

const parseShapes = (turtle: string) => parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");

test("detectPatterns() finds 'Candidate values via Dynamic SHACL' for sh:in [ sh:select ... ]", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 sh:path ex:category ;
      sh:in [ sh:select "SELECT ?value WHERE { ?value a ex:Category }" ] .
  `);

  const patterns = detectPatterns(shapesGraph);

  expect(patterns).toHaveLength(1);
  expect(patterns[0]).toMatchObject({
    pattern: "candidate-values-via-dynamic-shacl",
    label: "Candidate values via Dynamic SHACL",
    count: 1,
  });
  expect(patterns[0].subjects).toEqual([ex("property1").value]);
});

test("detectPatterns() finds nothing for a plain rdf:List sh:in", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 sh:path ex:status ; sh:in ( ex:Active ex:Inactive ) .
  `);

  expect(detectPatterns(shapesGraph)).toEqual([]);
});

test("detectPatterns() finds nothing when there's no sh:in at all", async () => {
  const shapesGraph = await parseShapes(`ex:property1 sh:path ex:status ; sh:minCount 1 .`);

  expect(detectPatterns(shapesGraph)).toEqual([]);
});

test("detectPatterns() counts multiple shapes using the dynamic sh:in idiom", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 sh:path ex:category ; sh:in [ sh:select "SELECT ?value WHERE { ?value a ex:A }" ] .
    ex:property2 sh:path ex:type ; sh:in [ sh:select "SELECT ?value WHERE { ?value a ex:B }" ] .
  `);

  const patterns = detectPatterns(shapesGraph);

  expect(patterns).toHaveLength(1);
  expect(patterns[0].count).toBe(2);
});

test("detectPatterns() finds 'Composed label via alternative path' for an sh:node's shui:LabelRole opted into st:mergeAlternatives", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 sh:path ex:ingredient ;
      sh:node [
        sh:property [
          sh:path [ sh:alternativePath ( schema:value schema:unitCode schema:name ) ] ;
          shui:propertyRole shui:LabelRole ;
          st:mergeAlternatives true ;
        ]
      ] .
  `);

  const patterns = detectPatterns(shapesGraph);

  expect(patterns).toHaveLength(1);
  expect(patterns[0]).toMatchObject({
    pattern: "composed-label-via-alternative-path",
    label: "Composed label via alternative path",
    count: 1,
  });
  expect(patterns[0].subjects).toEqual([ex("property1").value]);
});

test("detectPatterns() finds nothing for an sh:node's shui:LabelRole with a plain, non-alternative path", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 sh:path ex:ingredient ;
      sh:node [
        sh:property [
          sh:path schema:name ;
          shui:propertyRole shui:LabelRole ;
        ]
      ] .
  `);

  expect(detectPatterns(shapesGraph)).toEqual([]);
});

test("detectPatterns() finds nothing for an sh:alternativePath LabelRole without st:mergeAlternatives", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 sh:path ex:ingredient ;
      sh:node [
        sh:property [
          sh:path [ sh:alternativePath ( schema:value schema:unitCode schema:name ) ] ;
          shui:propertyRole shui:LabelRole ;
        ]
      ] .
  `);

  expect(detectPatterns(shapesGraph)).toEqual([]);
});

test("detectPatterns() counts multiple sh:node shapes using the st:mergeAlternatives LabelRole idiom", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 sh:path ex:ingredient1 ;
      sh:node [
        sh:property [
          sh:path [ sh:alternativePath ( schema:value schema:name ) ] ;
          shui:propertyRole shui:LabelRole ;
          st:mergeAlternatives true ;
        ]
      ] .
    ex:property2 sh:path ex:ingredient2 ;
      sh:node [
        sh:property [
          sh:path [ sh:alternativePath ( schema:value schema:name ) ] ;
          shui:propertyRole shui:LabelRole ;
          st:mergeAlternatives true ;
        ]
      ] .
  `);

  const patterns = detectPatterns(shapesGraph);

  expect(patterns).toHaveLength(1);
  expect(patterns[0].count).toBe(2);
});
