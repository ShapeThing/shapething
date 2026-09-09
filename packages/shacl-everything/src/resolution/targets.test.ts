import { expect, test } from "vite-plus/test";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, queryPrefixes } from "@/helpers/namespaces.ts";
import {
  facetableRootShapes,
  orphanedTargetWhereObjects,
  predicatesReferencedByTargetWhereShapes,
  shaclInstancesOfClass,
  shapesTargetingClass,
  shapesWhereTargetingFocusNode,
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

test("shapesWhereTargetingFocusNode 3.1.3.6: a shape whose sh:targetWhere value the focus node conforms to", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] .
      ex:HomeClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Home" ] ] .
    `,
    data: `ex:claim1 a ex:InsuranceClaim ; ex:claimType "Auto" .`,
  });

  const shapes = await shapesWhereTargetingFocusNode(ex("claim1"), shapesGraph, dataGraph);
  expect(shapes.map((t) => t.value)).toEqual([ex("AutoClaimShape").value]);
});

test("shapesWhereTargetingFocusNode 3.1.3.6: no sh:targetWhere shape conforms yields an empty list", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] .
    `,
    data: `ex:claim1 a ex:InsuranceClaim .`,
  });

  const shapes = await shapesWhereTargetingFocusNode(ex("claim1"), shapesGraph, dataGraph);
  expect(shapes).toEqual([]);
});

test("predicatesReferencedByTargetWhereShapes: collects sh:path from every sh:targetWhere value, across shapes", async () => {
  const { shapesGraph } = await graphs({
    shapes: `
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] .
      ex:HomeClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:kind ; sh:hasValue "Home" ] ] .
    `,
  });

  const predicates = predicatesReferencedByTargetWhereShapes(shapesGraph);
  expect(new Set(predicates.map((t) => t.value))).toEqual(
    new Set([ex("claimType").value, ex("kind").value]),
  );
});

test("predicatesReferencedByTargetWhereShapes: walks sh:and/sh:node inside the targetWhere value", async () => {
  const { shapesGraph } = await graphs({
    shapes: `
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [
          sh:node [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] ;
        ] .
    `,
  });

  const predicates = predicatesReferencedByTargetWhereShapes(shapesGraph);
  expect(predicates.map((t) => t.value)).toEqual([ex("claimType").value]);
});

test("predicatesReferencedByTargetWhereShapes: a targetWhere value with no sh:path yields an empty list", async () => {
  const { shapesGraph } = await graphs({
    shapes: `ex:AdultShape a sh:NodeShape ; sh:targetWhere [ sh:class ex:Person ] .`,
  });

  expect(predicatesReferencedByTargetWhereShapes(shapesGraph)).toEqual([]);
});

test("predicatesReferencedByTargetWhereShapes: no sh:targetWhere declared at all yields an empty list", async () => {
  const { shapesGraph } = await graphs({
    shapes: `ex:PlainShape a sh:NodeShape ; sh:targetClass ex:Person .`,
  });

  expect(predicatesReferencedByTargetWhereShapes(shapesGraph)).toEqual([]);
});

test("orphanedTargetWhereObjects: a value belonging only to a fragment that's no longer active is reported", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] ;
        sh:property [ sh:path ex:vehiclePlate ] .
    `,
    data: `ex:claim1 ex:claimType "Home" ; ex:vehiclePlate "AB-123-C" .`,
  });

  // ex:AutoClaimShape no longer matches claim1 (claimType is now "Home"), and nothing else
  // currently effective declares ex:vehiclePlate.
  const orphaned = await orphanedTargetWhereObjects(ex("claim1"), shapesGraph, dataGraph, []);

  expect(orphaned).toHaveLength(1);
  const [entry] = orphaned;
  if (entry.kind !== "value") throw new Error(`Expected a "value" entry, got "${entry.kind}"`);
  expect(entry.value.value).toEqual("AB-123-C");
  expect(entry.path.type).toEqual("predicate");
  expect((entry.path as { predicate: { value: string } }).predicate.value).toEqual(
    ex("vehiclePlate").value,
  );
});

test("orphanedTargetWhereObjects: a sh:memberShape property is reported as a memberShapeList entry, not a plain value", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] ;
        sh:property [ sh:path ex:passengers ; sh:memberShape [ sh:datatype xsd:string ] ] .
    `,
    data: `
      ex:claim1 ex:claimType "Home" ; ex:passengers ex:list1 .
      ex:list1 rdf:first "Alice" ; rdf:rest ex:list2 .
      ex:list2 rdf:first "Bob" ; rdf:rest rdf:nil .
    `,
  });

  const orphaned = await orphanedTargetWhereObjects(ex("claim1"), shapesGraph, dataGraph, []);

  expect(orphaned).toHaveLength(1);
  const [entry] = orphaned;
  if (entry.kind !== "memberShapeList") {
    throw new Error(`Expected a "memberShapeList" entry, got "${entry.kind}"`);
  }
  expect(entry.head.value).toEqual(ex("list1").value);
});

test("orphanedTargetWhereObjects: a path also declared by a currently-effective shape is left alone", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:MainShape a sh:NodeShape ; sh:property [ sh:path ex:vehiclePlate ] .
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] ;
        sh:property [ sh:path ex:vehiclePlate ] .
    `,
    data: `ex:claim1 ex:claimType "Home" ; ex:vehiclePlate "AB-123-C" .`,
  });

  // ex:AutoClaimShape is inactive, but ex:MainShape (currently effective) declares the same path.
  const orphaned = await orphanedTargetWhereObjects(ex("claim1"), shapesGraph, dataGraph, [
    ex("MainShape"),
  ]);

  expect(orphaned).toEqual([]);
});

test("orphanedTargetWhereObjects: a path also declared by a different, still-matching fragment is left alone", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] ;
        sh:property [ sh:path ex:vehiclePlate ] .
      ex:HomeClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Home" ] ] ;
        sh:property [ sh:path ex:vehiclePlate ] .
    `,
    data: `ex:claim1 ex:claimType "Home" ; ex:vehiclePlate "AB-123-C" .`,
  });

  // Caller already determined ex:HomeClaimShape is the one currently matching; it happens to share
  // ex:AutoClaimShape's own path, so nothing about it is orphaned.
  const orphaned = await orphanedTargetWhereObjects(ex("claim1"), shapesGraph, dataGraph, [
    ex("HomeClaimShape"),
  ]);

  expect(orphaned).toEqual([]);
});

test("orphanedTargetWhereObjects: a value also present in readOnlyGraph is never reported", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `
      ex:AutoClaimShape a sh:NodeShape ;
        sh:targetWhere [ sh:property [ sh:path ex:claimType ; sh:hasValue "Auto" ] ] ;
        sh:property [ sh:path ex:vehiclePlate ] .
    `,
    data: `ex:claim1 ex:claimType "Home" ; ex:vehiclePlate "AB-123-C" .`,
  });
  const { dataGraph: readOnlyGraph } = await graphs({
    data: `ex:claim1 ex:vehiclePlate "AB-123-C" .`,
  });

  const orphaned = await orphanedTargetWhereObjects(
    ex("claim1"),
    shapesGraph,
    dataGraph,
    [],
    readOnlyGraph,
  );

  expect(orphaned).toEqual([]);
});

test("orphanedTargetWhereObjects: no sh:targetWhere declared at all yields an empty list", async () => {
  const { shapesGraph, dataGraph } = await graphs({
    shapes: `ex:MainShape a sh:NodeShape ; sh:property [ sh:path ex:name ] .`,
    data: `ex:thing1 ex:name "Alice" .`,
  });

  expect(await orphanedTargetWhereObjects(ex("thing1"), shapesGraph, dataGraph, [])).toEqual([]);
});
