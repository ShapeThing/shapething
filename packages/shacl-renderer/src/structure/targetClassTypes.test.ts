import { expect, test } from "vite-plus/test";
import type { Quad_Subject } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { ex, queryPrefixes, rdf } from "@/helpers/namespaces.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { seedTargetClassTypes, targetClassOf } from "@/structure/targetClassTypes.ts";
import { NO_WIDGETS } from "@/widgets/lookup.ts";

const shapesTurtle = `${queryPrefixes}
ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .
ex:Recipe a sh:NodeShape, rdfs:Class .
ex:Thing a sh:ShapeClass .
ex:AmbiguousShape a sh:NodeShape ; sh:targetClass ex:A, ex:B .
ex:GenericShape a sh:NodeShape .
ex:SubjectsShape a sh:NodeShape ; sh:targetSubjectsOf ex:name .
`;

const node = async (nodeShapes: Quad_Subject[], dataTurtle = "") =>
  new NodeUIElement({
    shapesGraph: await parseRdf(shapesTurtle, "text/turtle"),
    dataGraph: await parseRdf(`${queryPrefixes}\n${dataTurtle}`, "text/turtle"),
    widgetRegistry: NO_WIDGETS,
    focusNode: ex("new"),
    nodeShapes,
  });

test("targetClassOf gives the one class a shape targets", async () => {
  const shapesGraph = await parseRdf(shapesTurtle, "text/turtle");
  expect(targetClassOf(ex("PersonShape"), shapesGraph)?.value).toBe(ex("Person").value);
  // An implicit class target: the shape is a class itself.
  expect(targetClassOf(ex("Recipe"), shapesGraph)?.value).toBe(ex("Recipe").value);
  expect(targetClassOf(ex("Thing"), shapesGraph)?.value).toBe(ex("Thing").value);
  // Which of the two a new resource is, the shape doesn't say.
  expect(targetClassOf(ex("AmbiguousShape"), shapesGraph)).toBeUndefined();
  expect(targetClassOf(ex("GenericShape"), shapesGraph)).toBeUndefined();
  expect(targetClassOf(ex("SubjectsShape"), shapesGraph)).toBeUndefined();
});

test("seedTargetClassTypes writes the rdf:type of each node shape's class target", async () => {
  const element = await node([ex("PersonShape"), ex("Recipe"), ex("GenericShape")]);
  const added = seedTargetClassTypes(element);

  expect(added.map((quad) => quad.object.value)).toEqual([ex("Person").value, ex("Recipe").value]);
  for (const quad of added) {
    expect(quad.subject.equals(ex("new"))).toBe(true);
    expect(quad.predicate.equals(rdf("type"))).toBe(true);
    expect(element.dataGraph.countQuads(quad.subject, quad.predicate, quad.object, null)).toBe(1);
  }
});

test("seedTargetClassTypes leaves a type the resource already has alone", async () => {
  const element = await node([ex("PersonShape")], "ex:new a ex:Person .");
  expect(seedTargetClassTypes(element)).toEqual([]);
  expect(element.dataGraph.getQuads(ex("new"), rdf("type"), null)).toHaveLength(1);
});

test("seedTargetClassTypes writes the same class only once", async () => {
  const element = await node([ex("PersonShape"), factory.namedNode(ex("PersonShape").value)]);
  expect(seedTargetClassTypes(element)).toHaveLength(1);
});
