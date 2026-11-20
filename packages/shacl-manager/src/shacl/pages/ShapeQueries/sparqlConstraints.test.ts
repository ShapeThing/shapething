import type { BlankNode, NamedNode, Quad_Object } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { select } from "../../../data-model/select.ts";
import sparqlConstraints from "./sparqlConstraints.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const sh = (local: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${local}`);

const managed = iri("managed");
const imported = iri("imported");

const store = RdfStore.createDefault();
const add = (s: NamedNode | BlankNode, p: string, o: Quad_Object, graph: NamedNode) =>
  store.addQuad(factory.quad(s, sh(p), o, graph));

const constraint = (name: string, graph: NamedNode, messages: string[] = []) => {
  add(iri(name), "select", factory.literal(`SELECT $this WHERE { # ${name}\n}`), graph);
  for (const message of messages) add(iri(name), "message", factory.literal(message, "en"), graph);
  return iri(name);
};

// PersonShape: one node-level constraint, one on a property shape.
add(iri("PersonShape"), "targetClass", iri("Person"), managed);
add(iri("PersonShape"), "sparql", constraint("NoSelfFriend", managed, ["No self friend"]), managed);
add(iri("PersonShape"), "property", iri("PersonShape-name"), managed);
add(iri("PersonShape-name"), "path", iri("name"), managed);
add(iri("PersonShape-name"), "sparql", constraint("UniqueName", managed), managed);
// An imported shape for the same class.
add(iri("ImportedPersonShape"), "targetClass", iri("Person"), imported);
add(iri("ImportedPersonShape"), "sparql", constraint("Imported", imported), imported);
// A blank-node shape.
const blankShape = factory.blankNode("anonymous");
add(blankShape, "sparql", constraint("OnBlank", managed), managed);

const rows = async (kind: "class" | "shape", subject: NamedNode | BlankNode, origin = "managed") =>
  (
    await select(sparqlConstraints, store, {
      subject,
      kind: factory.literal(kind),
      dataModel: managed,
      origin: factory.literal(origin),
    })
  ).map(({ shape, path, constraint, select, message }) => ({
    shape: shape.value.replace("http://example.org/", ""),
    path: path?.value.replace("http://example.org/", ""),
    constraint: constraint.value.replace("http://example.org/", ""),
    hasSelect: !!select,
    message: message?.value,
  }));

test("shape: node-level constraints first, then property-level ones", async () => {
  expect(await rows("shape", iri("PersonShape"))).toEqual([
    {
      shape: "PersonShape",
      path: undefined,
      constraint: "NoSelfFriend",
      hasSelect: true,
      message: "No self friend",
    },
    {
      shape: "PersonShape",
      path: "name",
      constraint: "UniqueName",
      hasSelect: true,
      message: undefined,
    },
  ]);
});

test("class: the constraints of every shape of the origin targeting it", async () => {
  expect((await rows("class", iri("Person"))).map((row) => row.constraint)).toEqual([
    "NoSelfFriend",
    "UniqueName",
  ]);
  expect((await rows("class", iri("Person"), "imported")).map((row) => row.constraint)).toEqual([
    "Imported",
  ]);
});

test("shape: a blank-node shape", async () => {
  expect((await rows("shape", blankShape)).map((row) => row.constraint)).toEqual(["OnBlank"]);
});
