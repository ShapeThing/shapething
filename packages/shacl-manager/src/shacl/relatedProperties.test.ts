import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { relatedProperties } from "./relatedProperties.ts";

const factory = new DataFactory();
const ex = (value: string) => factory.namedNode(`http://example.org/${value}`);
const sh = (local: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${local}`);
const rdf = (local: string) =>
  factory.namedNode(`http://www.w3.org/1999/02/22-rdf-syntax-ns#${local}`);
const subClassOf = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf");

// Person has a name; an Employee, a Person, gets the EmployeeShape's name too. The PersonShape
// pulls in the LabelledShape, whose label shares a path with the PersonShape's own. The
// OtherShape's name is on an unrelated class, and the AddressShape only describes a value.
function store() {
  const store = RdfStore.createDefault();
  const triples = [
    [ex("PersonShape"), sh("targetClass"), ex("Person")],
    [ex("PersonShape"), sh("property"), ex("personName")],
    [ex("PersonShape"), sh("property"), ex("personLabel")],
    [ex("PersonShape"), sh("property"), ex("personAddress")],
    [ex("PersonShape"), sh("node"), ex("LabelledShape")],
    [ex("personName"), sh("path"), ex("name")],
    [ex("personLabel"), sh("path"), ex("label")],
    [ex("personAddress"), sh("path"), ex("address")],
    [ex("personAddress"), sh("node"), ex("AddressShape")],

    [ex("Employee"), subClassOf, ex("Person")],
    [ex("EmployeeShape"), sh("targetClass"), ex("Employee")],
    [ex("EmployeeShape"), sh("property"), ex("employeeName")],
    [ex("employeeName"), sh("path"), ex("name")],

    [ex("LabelledShape"), sh("property"), ex("labelledLabel")],
    [ex("labelledLabel"), sh("path"), ex("label")],

    [ex("AddressShape"), sh("property"), ex("addressName")],
    [ex("addressName"), sh("path"), ex("name")],

    [ex("OtherShape"), sh("targetClass"), ex("Other")],
    [ex("OtherShape"), sh("property"), ex("otherName")],
    [ex("otherName"), sh("path"), ex("name")],
  ] as const;
  for (const [s, p, o] of triples) store.addQuad(factory.quad(s, p, o));
  return store;
}

const names = (property: string) =>
  relatedProperties(store(), ex(property)).map(({ property, shapes }) => [
    property.value.replace("http://example.org/", ""),
    shapes.map((shape) => shape.value.replace("http://example.org/", "")),
  ]);

test("a subclass's shape is combined with the superclass's, both ways", () => {
  expect(names("personName")).toEqual([["employeeName", ["EmployeeShape"]]]);
  expect(names("employeeName")).toEqual([["personName", ["PersonShape"]]]);
});

test("a shape pulled in through sh:node is combined with the shape pulling it in", () => {
  expect(names("personLabel")).toEqual([["labelledLabel", ["LabelledShape"]]]);
  expect(names("labelledLabel")).toEqual([["personLabel", ["PersonShape"]]]);
});

test("a value shape and an unrelated class are not combined", () => {
  expect(names("addressName")).toEqual([]);
  expect(names("otherName")).toEqual([]);
});

test("a shape pulled in through sh:and is combined too", () => {
  const graph = store();
  const list = factory.blankNode("list");
  graph.addQuad(factory.quad(ex("OtherShape"), sh("and"), list));
  graph.addQuad(factory.quad(list, rdf("first"), ex("AddressShape")));
  graph.addQuad(factory.quad(list, rdf("rest"), rdf("nil")));
  const related = relatedProperties(graph, ex("addressName")).map(({ property }) => property.value);
  expect(related).toEqual([ex("otherName").value]);
});
