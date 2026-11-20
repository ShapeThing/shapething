import type { BlankNode, NamedNode, Quad_Object } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { select } from "@shapething/shacl-renderer";
import shapeUsage from "./shapeUsage.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const sh = (local: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${local}`);

const managed = iri("managed");
const imported = iri("imported");

const store = RdfStore.createDefault();
const add = (s: NamedNode | BlankNode, p: NamedNode, o: Quad_Object, graph: NamedNode) =>
  store.addQuad(factory.quad(s, p, o, graph));

// A property shape shared by a managed and an imported shape; a constraint on one shape.
add(iri("PersonShape"), sh("property"), iri("name"), managed);
add(iri("AgentShape"), sh("property"), iri("name"), imported);
add(iri("PersonShape"), sh("sparql"), iri("constraint"), managed);

const usage = async (node: NamedNode, predicate: NamedNode) =>
  (await select(shapeUsage, store, { node, predicate, dataModel: managed })).map(
    ({ shape, shapeOrigin }) => [shape.value.replace("http://example.org/", ""), shapeOrigin.value],
  );

test("every shape holding the node, with its origin", async () => {
  expect(await usage(iri("name"), sh("property"))).toEqual([
    ["AgentShape", "imported"],
    ["PersonShape", "managed"],
  ]);
});

test("only through the given predicate", async () => {
  expect(await usage(iri("constraint"), sh("property"))).toEqual([]);
  expect(await usage(iri("constraint"), sh("sparql"))).toEqual([["PersonShape", "managed"]]);
});
