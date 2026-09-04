import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes, sh } from "@/helpers/namespaces.ts";
import { shapesGraphWithoutDynamicIn } from "./shapesGraphWithoutDynamicIn.ts";

const parseShapes = (turtle: string) => parseRdf(`${queryPrefixes}\n\n${turtle}`, "text/turtle");

test("shapesGraphWithoutDynamicIn() drops a dynamic sh:in [ sh:select ] triple, keeping the shape's other constraints", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 a sh:PropertyShape ;
      sh:path ex:bornIn ;
      sh:class ex:Country ;
      sh:in [ sh:select "SELECT ?value WHERE { ?value a ex:AllowedCountry }" ] .
  `);

  const filtered = shapesGraphWithoutDynamicIn(shapesGraph);

  expect(filtered.getQuads(ex("property1"), sh("in"))).toHaveLength(0);
  expect(filtered.getQuads(ex("property1"), sh("class"))).toHaveLength(1);
  expect(filtered.getQuads(ex("property1"), sh("path"))).toHaveLength(1);
});

test("shapesGraphWithoutDynamicIn() leaves a plain rdf:List sh:in completely untouched", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 a sh:PropertyShape ;
      sh:path ex:status ;
      sh:in ( ex:Active ex:Inactive ) .
  `);

  const filtered = shapesGraphWithoutDynamicIn(shapesGraph);

  expect(filtered.getQuads(ex("property1"), sh("in"))).toHaveLength(1);
  expect(filtered.getQuads().length).toEqual(shapesGraph.getQuads().length);
});

test("shapesGraphWithoutDynamicIn() leaves an sh:in with more than one value untouched, even if one is a dynamic-looking blank node", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 a sh:PropertyShape ;
      sh:path ex:bornIn ;
      sh:in ex:literalValue, [ sh:select "SELECT ?value WHERE { ?value a ex:AllowedCountry }" ] .
  `);

  const filtered = shapesGraphWithoutDynamicIn(shapesGraph);

  expect(filtered.getQuads(ex("property1"), sh("in"))).toHaveLength(2);
});

test("shapesGraphWithoutDynamicIn() returns the same store unchanged when there's nothing dynamic to strip", async () => {
  const shapesGraph = await parseShapes(`
    ex:property1 a sh:PropertyShape ; sh:path ex:bornIn ; sh:minCount 1 .
  `);

  expect(shapesGraphWithoutDynamicIn(shapesGraph)).toBe(shapesGraph);
});
