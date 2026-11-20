import type { NamedNode } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { select } from "@shapething/shacl-renderer";
import classHierarchy from "./classHierarchy.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const rdfType = factory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const owlClass = factory.namedNode("http://www.w3.org/2002/07/owl#Class");
const rdfsClass = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#Class");
const owl = (local: string) => factory.namedNode(`http://www.w3.org/2002/07/owl#${local}`);
const subClassOf = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf");

const managed = iri("managed");
const imported = iri("imported");

type ClassSpec = {
  graph: NamedNode;
  superClasses?: string[];
  type?: NamedNode | null;
};
const cls = (name: string, { graph, superClasses = [], type = owlClass }: ClassSpec) => [
  ...(type ? [factory.quad(iri(name), rdfType, type, graph)] : []),
  ...superClasses.map((superClass) => factory.quad(iri(name), subClassOf, iri(superClass), graph)),
];

// Managed: Person ⊂ Agent ⊂ Thing, Organisation ⊂ Agent, Employee ⊂ Person and Employee ⊂ Worker.
// Dataset ⊂ Resource, but Resource is imported, so Dataset is a managed root.
// Imported: Report ⊂ Dataset, which is managed, so Report is an imported root.
const store = RdfStore.createDefault();
for (const quad of [
  ...cls("Thing", { graph: managed }),
  ...cls("Agent", { graph: managed, superClasses: ["Thing"], type: rdfsClass }),
  ...cls("Person", { graph: managed, superClasses: ["Agent"] }),
  ...cls("Organisation", { graph: managed, superClasses: ["Agent"], type: null }),
  ...cls("Worker", { graph: managed }),
  ...cls("Employee", { graph: managed, superClasses: ["Person", "Worker"] }),
  ...cls("Dataset", { graph: managed, superClasses: ["Resource"] }),
  ...cls("Resource", { graph: imported }),
  ...cls("Report", { graph: imported, superClasses: ["Dataset"] }),
  // Anonymous classes: a restriction as a superclass, an untyped unionOf, a typed blank class.
  factory.quad(iri("Person"), subClassOf, factory.blankNode("restriction"), managed),
  factory.quad(factory.blankNode("restriction"), rdfType, owl("Restriction"), managed),
  factory.quad(factory.blankNode("union"), owl("unionOf"), factory.blankNode("list"), managed),
  factory.quad(factory.blankNode("typed"), rdfType, owlClass, imported),
]) {
  store.addQuad(quad);
}

const rows = async (origin: "managed" | "imported", section: "hierarchy" | "other" = "hierarchy") =>
  (
    await select(classHierarchy, store, {
      dataModel: managed,
      origin: factory.literal(origin),
      section: factory.literal(section),
    })
  ).map(({ class: cls, parent }) => [
    cls.value.replace("http://example.org/", ""),
    parent?.value.replace("http://example.org/", ""),
  ]);

test("managed: declared and subClassOf classes, nested by their direct superclass", async () => {
  expect(await rows("managed")).toEqual([
    ["Agent", "Thing"],
    ["Dataset", undefined],
    ["Employee", "Person"],
    ["Employee", "Worker"],
    ["Organisation", "Agent"],
    ["Person", "Agent"],
    ["Thing", undefined],
    ["Worker", undefined],
  ]);
});

test("imported: a superclass from the other origin makes a root", async () => {
  expect(await rows("imported")).toEqual([
    ["Report", undefined],
    ["Resource", undefined],
  ]);
});

test("other: exactly the anonymous classes, flat", async () => {
  expect((await rows("managed", "other")).map(([cls]) => cls).sort()).toEqual([
    "restriction",
    "union",
  ]);
  expect(await rows("imported", "other")).toEqual([["typed", undefined]]);
});
