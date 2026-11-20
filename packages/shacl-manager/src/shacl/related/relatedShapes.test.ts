import type { BlankNode, NamedNode, Quad_Object } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { select } from "../../data-model/select.ts";
import relatedShapes from "./relatedShapes.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const sh = (local: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${local}`);
const rdfType = factory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const subClassOf = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf");

const managed = iri("managed");
const imported = iri("imported");

const store = RdfStore.createDefault();
const add = (s: NamedNode | BlankNode, p: NamedNode, o: Quad_Object, graph = managed) =>
  store.addQuad(factory.quad(s, p, o, graph));

// PersonShape targets Person, has a property ex:knows and an inverse property ^ex:parentOf.
const knows = factory.blankNode("knows");
const child = factory.blankNode("child");
const inverse = factory.blankNode("inverse");
add(iri("PersonShape"), sh("targetClass"), iri("Person"));
add(iri("PersonShape"), sh("property"), knows);
add(knows, sh("path"), iri("knows"));
add(iri("PersonShape"), sh("property"), child);
add(child, sh("path"), inverse);
add(inverse, sh("inversePath"), iri("parentOf"));

// Related: through a shared predicate, an inverse predicate, and an instance of a subclass.
add(iri("KnowsShape"), sh("targetSubjectsOf"), iri("knows"), imported);
add(iri("ChildShape"), sh("targetObjectsOf"), iri("parentOf"));
add(iri("Student"), subClassOf, iri("Person"));
add(iri("alice"), rdfType, iri("Student"));
add(iri("AliceShape"), sh("targetNode"), iri("alice"));
// Not related: objects of ex:knows are not PersonShape's focus nodes; another predicate.
add(iri("KnownShape"), sh("targetObjectsOf"), iri("knows"));
add(iri("OtherShape"), sh("targetSubjectsOf"), iri("other"));

const rows = async (kind: "class" | "shape", subject: NamedNode, origin = "managed") =>
  (
    await select(relatedShapes, store, {
      subject,
      kind: factory.literal(kind),
      dataModel: managed,
      origin: factory.literal(origin),
    })
  ).map(({ shape, shapeOrigin, mechanism, via }) => ({
    shape: shape.value.replace("http://example.org/", ""),
    origin: shapeOrigin.value,
    mechanism: mechanism.value,
    via: via.value.replace("http://example.org/", ""),
  }));

const expected = [
  { shape: "AliceShape", origin: "managed", mechanism: "targetNode", via: "alice" },
  { shape: "ChildShape", origin: "managed", mechanism: "targetObjectsOf", via: "parentOf" },
  { shape: "KnowsShape", origin: "imported", mechanism: "targetSubjectsOf", via: "knows" },
];

test("shape: shapes applying through targetSubjectsOf, targetObjectsOf and targetNode", async () => {
  expect(await rows("shape", iri("PersonShape"))).toEqual(expected);
});

test("class: the same, through the origin's shapes targeting the class", async () => {
  expect(await rows("class", iri("Person"))).toEqual(expected);
  expect(await rows("class", iri("Person"), "imported")).toEqual([]);
});

test("a shape targeting subjects of a predicate relates to others targeting the same", async () => {
  expect(await rows("shape", iri("OtherShape"))).toEqual([]);
  add(iri("AlsoOtherShape"), sh("targetSubjectsOf"), iri("other"));
  expect((await rows("shape", iri("OtherShape"))).map((row) => row.shape)).toEqual([
    "AlsoOtherShape",
  ]);
});
