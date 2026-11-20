import type { NamedNode, Quad } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { select } from "@shapething/shacl-renderer";
import shapeHierarchy from "./shapeHierarchy.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const rdfType = factory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const subClassOf = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf");
const sh = (local: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${local}`);

const managed = iri("managed");
const imported = iri("imported");
const ontology = iri("ontology");

type ShapeSpec = { graph: NamedNode; properties?: number; targetClass?: string; typed?: boolean };
const shape = (name: string, { graph, properties = 0, targetClass, typed = true }: ShapeSpec) => [
  ...(typed ? [factory.quad(iri(name), rdfType, sh("NodeShape"), graph)] : []),
  ...(targetClass ? [factory.quad(iri(name), sh("targetClass"), iri(targetClass), graph)] : []),
  ...Array.from({ length: properties }, (_, index) =>
    factory.quad(iri(name), sh("property"), iri(`${name}-p${index}`), graph),
  ),
];
const sub = (child: string, parent: string): Quad =>
  factory.quad(iri(child), subClassOf, iri(parent), ontology);

// Classes: Person ⊂ Agent ⊂ Thing, Organisation ⊂ Agent, Dataset ⊂ Resource.
// Agent has no shape, so PersonShape's nearest shaped superclass is Thing.
const store = RdfStore.createDefault();
for (const quad of [
  sub("Person", "Agent"),
  sub("Agent", "Thing"),
  sub("Organisation", "Agent"),
  sub("Dataset", "Resource"),
  ...shape("ThingShape", { graph: managed, properties: 1, targetClass: "Thing" }),
  ...shape("PersonShape", { graph: managed, properties: 3, targetClass: "Person" }),
  // Same class as PersonShape: a sibling, not a child.
  ...shape("PersonRulesShape", { graph: managed, targetClass: "Person", typed: false }),
  ...shape("OrganisationShape", { graph: managed, properties: 2, targetClass: "Organisation" }),
  // Its superclass only has an imported shape, so within "managed" it is a root.
  ...shape("DatasetShape", { graph: managed, targetClass: "Dataset" }),
  ...shape("AddressShape", { graph: managed, properties: 4 }),
  ...shape("ResourceShape", { graph: imported, properties: 5, targetClass: "Resource" }),
  ...shape("LiteralShape", { graph: imported }),
]) {
  store.addQuad(quad);
}

const rows = async (origin: "managed" | "imported", section: "hierarchy" | "other") =>
  (
    await select(shapeHierarchy, store, {
      dataModel: managed,
      origin: factory.literal(origin),
      section: factory.literal(section),
    })
  ).map(({ shape, parent, propertyCount }) => [
    shape.value.replace("http://example.org/", ""),
    parent?.value.replace("http://example.org/", ""),
    Number(propertyCount.value),
  ]);

test("hierarchy: targetClass shapes, nested by the nearest shaped superclass", async () => {
  expect(await rows("managed", "hierarchy")).toEqual([
    ["PersonShape", "ThingShape", 3],
    ["OrganisationShape", "ThingShape", 2],
    ["ThingShape", undefined, 1],
    ["DatasetShape", undefined, 0],
    ["PersonRulesShape", "ThingShape", 0],
  ]);
});

test("other: exactly the shapes without a targetClass", async () => {
  expect(await rows("managed", "other")).toEqual([["AddressShape", undefined, 4]]);
});

test("imported origin", async () => {
  expect(await rows("imported", "hierarchy")).toEqual([["ResourceShape", undefined, 5]]);
  expect(await rows("imported", "other")).toEqual([["LiteralShape", undefined, 0]]);
});
