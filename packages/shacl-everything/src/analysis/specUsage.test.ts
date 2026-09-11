import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { queryPrefixes } from "@/helpers/namespaces.ts";
import { analyzeSpecUsage } from "@/analysis/specUsage.ts";

const parseShapes = (turtle: string) => parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");

test("analyzeSpecUsage() attributes a plain SHACL 1.0 Core constraint to SHACL 1 Core", async () => {
  const shapesGraph = await parseShapes(`
    ex:shape a sh:NodeShape ;
      sh:property [ sh:path ex:name ; sh:minCount 1 ; sh:datatype xsd:string ] .
  `);

  const usage = analyzeSpecUsage(shapesGraph);

  expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({ spec: "shacl-core-1", count: 5, percentage: 100 });
});

test("analyzeSpecUsage() attributes a term new to SHACL 1.2 (sh:unit) to SHACL Core 1.2, distinct from 1.0 terms in the same shape", async () => {
  const shapesGraph = await parseShapes(`
    ex:shape a sh:NodeShape ;
      sh:property [ sh:path ex:amount ; sh:minCount 1 ; sh:unit ex:EUR ] .
  `);

  const usage = analyzeSpecUsage(shapesGraph);
  const bySpec = Object.fromEntries(usage.map((u) => [u.spec, u.count]));

  expect(bySpec["shacl-core-1"]).toBeGreaterThan(0);
  expect(bySpec["shacl-core-1-2"]).toBe(1);
});

test("analyzeSpecUsage() splits across SHACL UI, DASH and ShapeThing namespaces", async () => {
  const shapesGraph = await parseShapes(`
    ex:shape a sh:NodeShape ;
      sh:property [
        sh:path ex:name ;
        shui:editor st:IconifyEditor ;
        dash:viewer dash:StringViewer ;
      ] .
  `);

  const usage = analyzeSpecUsage(shapesGraph);
  const bySpec = Object.fromEntries(usage.map((u) => [u.spec, u.count]));

  expect(bySpec["shacl-ui-1-2"]).toBe(1); // shui:editor
  expect(bySpec["shapething"]).toBe(1); // st:IconifyEditor
  expect(bySpec["dash"]).toBe(2); // dash:viewer + dash:StringViewer
});

test("analyzeSpecUsage() ignores triples with no recognized spec term (e.g. plain user/data vocabulary)", async () => {
  const shapesGraph = await parseShapes(`
    ex:shape ex:customAnnotation "not part of any spec" .
  `);

  expect(analyzeSpecUsage(shapesGraph)).toEqual([]);
});

test("analyzeSpecUsage() returns percentages that add up to 100", async () => {
  const shapesGraph = await parseShapes(`
    ex:shape a sh:NodeShape ;
      sh:property [ sh:path ex:name ; shui:editor st:IconifyEditor ; sh:unit ex:EUR ] .
  `);

  const usage = analyzeSpecUsage(shapesGraph);
  const totalPercentage = usage.reduce((sum, u) => sum + u.percentage, 0);

  expect(totalPercentage).toBeCloseTo(100);
});
