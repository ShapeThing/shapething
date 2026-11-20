import type { BlankNode, NamedNode, Quad_Object } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { select } from "@shapething/shacl-renderer";
import shapeProperties from "./shapeProperties.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const sh = (local: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${local}`);
const integer = factory.namedNode("http://www.w3.org/2001/XMLSchema#integer");

const managed = iri("managed");
const imported = iri("imported");

const store = RdfStore.createDefault();
const add = (s: NamedNode | BlankNode, p: string, o: Quad_Object, graph: NamedNode) =>
  store.addQuad(factory.quad(s, sh(p), o, graph));

// PersonShape: name (order 2), age (order 1), email (unordered, with an sh:name).
const name = factory.blankNode("name");
const age = factory.blankNode("age");
const email = factory.blankNode("email");
add(iri("PersonShape"), "targetClass", iri("Person"), managed);
add(iri("PersonShape"), "property", name, managed);
add(iri("PersonShape"), "property", age, managed);
add(iri("PersonShape"), "property", email, managed);
add(name, "path", iri("name"), managed);
add(name, "order", factory.literal("2", integer), managed);
add(age, "path", iri("age"), managed);
add(age, "order", factory.literal("1", integer), managed);
add(email, "path", iri("email"), managed);
add(email, "name", factory.literal("E-mail", "en"), managed);
// An imported shape for the same class.
const nickname = factory.blankNode("nickname");
add(iri("ImportedPersonShape"), "targetClass", iri("Person"), imported);
add(iri("ImportedPersonShape"), "property", nickname, imported);
add(nickname, "path", iri("nickname"), imported);

// A property group with property shapes from both PersonShape and ImportedPersonShape.
add(name, "group", iri("NameGroup"), managed);
add(nickname, "group", iri("NameGroup"), imported);

const rows = async (
  kind: "class" | "shape" | "group",
  subject: NamedNode | BlankNode,
  origin = "managed",
) =>
  (
    await select(shapeProperties, store, {
      subject,
      kind: factory.literal(kind),
      dataModel: managed,
      origin: factory.literal(origin),
    })
  ).map(({ path, name }) => ({
    path: path?.value.replace("http://example.org/", ""),
    name: name?.value,
  }));

test("shape: property shapes in sh:order, unordered last", async () => {
  expect(await rows("shape", iri("PersonShape"))).toEqual([
    { path: "age", name: undefined },
    { path: "name", name: undefined },
    { path: "email", name: "E-mail" },
  ]);
});

test("class: the property shapes of every shape of the origin targeting it", async () => {
  expect((await rows("class", iri("Person"))).map((row) => row.path)).toEqual([
    "age",
    "name",
    "email",
  ]);
  expect((await rows("class", iri("Person"), "imported")).map((row) => row.path)).toEqual([
    "nickname",
  ]);
});

test("group: every property shape in the group, whichever shape and origin it is on", async () => {
  expect(await rows("group", iri("NameGroup"))).toEqual([
    { path: "nickname", name: undefined },
    { path: "name", name: undefined },
  ]);
});
