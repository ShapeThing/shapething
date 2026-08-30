import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import {
  facetableRootShapes,
  shaclInstancesOfClass,
  shapesTargetingClass,
  targetsOfShape,
} from "@/resolution/targets.ts";

async function graphs({ shapes, data }: { shapes?: string; data?: string }) {
  return {
    shapesGraph: await parseRdf(shapes ? `${queryPrefixes}\n\n${shapes}` : "", "text/turtle"),
    dataGraph: await parseRdf(data ? `${queryPrefixes}\n\n${data}` : "", "text/turtle"),
  };
}

test("shaclInstancesOfClass: exact rdf:type match", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    data: `ex:Alice a ex:Person . ex:NewYork a ex:Place .`,
  });

  const instances = shaclInstancesOfClass(ex("Person"), dataGraph, shapesGraph);
  expect(instances.map((t) => t.value)).toEqual([ex("Alice").value]);
});

test("shaclInstancesOfClass: transitive rdfs:subClassOf, declared in the shapes graph (3.1.3.2)", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:Doctor rdfs:subClassOf ex:Person .`,
    data: `ex:Who a ex:Doctor . ex:House a ex:Nephrologist .`,
  });

  const instances = shaclInstancesOfClass(ex("Person"), dataGraph, shapesGraph);
  expect(instances.map((t) => t.value)).toEqual([ex("Who").value]);
});

test("shaclInstancesOfClass: cyclical subClassOf terminates instead of looping forever", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:A rdfs:subClassOf ex:B . ex:B rdfs:subClassOf ex:A .`,
    data: `ex:Thing a ex:A .`,
  });

  const instances = shaclInstancesOfClass(ex("B"), dataGraph, shapesGraph);
  expect(instances.map((t) => t.value)).toEqual([ex("Thing").value]);
});

test("shapesTargetingClass: shapes declaring sh:targetClass for the given class", async () => {
  const { shapesGraph } = await graphs({
    shapes: `ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .`,
  });

  const shapes = shapesTargetingClass(ex("Person"), shapesGraph);
  expect(shapes.map((t) => t.value)).toEqual([ex("PersonShape").value]);
});

test("targetsOfShape 3.1.3.1: node targets", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:PersonShape a sh:NodeShape ; sh:targetNode ex:Alice .`,
    data: `ex:Alice a ex:Person . ex:Bob a ex:Person .`,
  });

  const targets = targetsOfShape(ex("PersonShape"), shapesGraph, dataGraph);
  expect(targets.map((t) => t.value)).toEqual([ex("Alice").value]);
});

test("targetsOfShape 3.1.3.2: class-based targets", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .`,
    data: `ex:Alice a ex:Person . ex:Bob a ex:Person . ex:NewYork a ex:Place .`,
  });

  const targets = targetsOfShape(ex("PersonShape"), shapesGraph, dataGraph);
  expect(new Set(targets.map((t) => t.value))).toEqual(
    new Set([ex("Alice").value, ex("Bob").value]),
  );
});

test("targetsOfShape 3.1.3.3: implicit class targets (shape is also rdfs:Class)", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:Person a rdfs:Class, sh:NodeShape .`,
    data: `ex:Alice a ex:Person . ex:NewYork a ex:Place .`,
  });

  const targets = targetsOfShape(ex("Person"), shapesGraph, dataGraph);
  expect(targets.map((t) => t.value)).toEqual([ex("Alice").value]);
});

test("targetsOfShape 3.1.3.3: sh:ShapeClass shortcut needs no separate NodeShape/Class typing", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:Person a sh:ShapeClass .`,
    data: `ex:Alice a ex:Person .`,
  });

  const targets = targetsOfShape(ex("Person"), shapesGraph, dataGraph);
  expect(targets.map((t) => t.value)).toEqual([ex("Alice").value]);
});

test("targetsOfShape 3.1.3.4: subjects-of targets", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:TargetSubjectsOfExampleShape a sh:NodeShape ; sh:targetSubjectsOf ex:knows .`,
    data: `ex:Alice ex:knows ex:Bob . ex:Bob ex:livesIn ex:NewYork .`,
  });

  const targets = targetsOfShape(ex("TargetSubjectsOfExampleShape"), shapesGraph, dataGraph);
  expect(targets.map((t) => t.value)).toEqual([ex("Alice").value]);
});

test("targetsOfShape 3.1.3.5: objects-of targets", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:TargetObjectsOfExampleShape a sh:NodeShape ; sh:targetObjectsOf ex:knows .`,
    data: `ex:Alice ex:knows ex:Bob . ex:Bob ex:livesIn ex:NewYork .`,
  });

  const targets = targetsOfShape(ex("TargetObjectsOfExampleShape"), shapesGraph, dataGraph);
  expect(targets.map((t) => t.value)).toEqual([ex("Bob").value]);
});

test("targetsOfShape 3.1.3.7: explicit shape targets (sh:shape, declared in the data graph)", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:PersonShape a sh:NodeShape .`,
    data: `ex:Alice a ex:Person ; sh:shape ex:PersonShape . ex:Bob a ex:Person .`,
  });

  const targets = targetsOfShape(ex("PersonShape"), shapesGraph, dataGraph);
  expect(targets.map((t) => t.value)).toEqual([ex("Alice").value]);
});

test("facetableRootShapes: finds every explicit target declaration", async () => {
  const { shapesGraph } = await graphs({
    shapes: `
      ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .
      ex:AliceShape a sh:NodeShape ; sh:targetNode ex:Alice .
      ex:KnowsShape a sh:NodeShape ; sh:targetSubjectsOf ex:knows .
      ex:KnownByShape a sh:NodeShape ; sh:targetObjectsOf ex:knows .
    `,
  });

  const roots = facetableRootShapes(shapesGraph);
  expect(new Set(roots.map((t) => t.value))).toEqual(
    new Set([
      ex("PersonShape").value,
      ex("AliceShape").value,
      ex("KnowsShape").value,
      ex("KnownByShape").value,
    ]),
  );
});

test("facetableRootShapes: finds implicit class-shapes (3.1.3.3) and sh:ShapeClass shapes", async () => {
  const { shapesGraph } = await graphs({
    shapes: `
      ex:Person a rdfs:Class, sh:NodeShape .
      ex:Organization a sh:ShapeClass .
      ex:NotAShape a rdfs:Class .
    `,
  });

  const roots = facetableRootShapes(shapesGraph);
  expect(new Set(roots.map((t) => t.value))).toEqual(
    new Set([ex("Person").value, ex("Organization").value]),
  );
});

test("facetableRootShapes: no targets declared at all yields an empty list", async () => {
  const { shapesGraph } = await graphs({
    shapes: `ex:PlainShape a sh:NodeShape ; sh:property [ sh:path ex:name ] .`,
  });

  expect(facetableRootShapes(shapesGraph)).toEqual([]);
});
