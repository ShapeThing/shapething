import type { BlankNode, NamedNode, Quad_Object } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { select } from "../../../data-model/select.ts";
import shaclRules from "./shaclRules.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const sh = (local: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${local}`);
const rdfsLabel = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#label");
const integer = factory.namedNode("http://www.w3.org/2001/XMLSchema#integer");

const managed = iri("managed");
const imported = iri("imported");

const store = RdfStore.createDefault();
const add = (s: NamedNode | BlankNode, p: string, o: Quad_Object, graph: NamedNode) =>
  store.addQuad(factory.quad(s, sh(p), o, graph));

// PersonShape: B runs before A (sh:order), A has a label.
add(iri("PersonShape"), "targetClass", iri("Person"), managed);
add(iri("PersonShape"), "rule", iri("RuleA"), managed);
add(iri("PersonShape"), "rule", iri("RuleB"), managed);
add(iri("RuleA"), "order", factory.literal("1", integer), managed);
store.addQuad(factory.quad(iri("RuleA"), rdfsLabel, factory.literal("Rule A", "en"), managed));
add(iri("RuleB"), "order", factory.literal("-1", integer), managed);
// An imported shape for the same class.
add(iri("ImportedPersonShape"), "targetClass", iri("Person"), imported);
add(iri("ImportedPersonShape"), "rule", iri("ImportedRule"), imported);
// A blank-node shape.
const blankShape = factory.blankNode("anonymous");
add(blankShape, "rule", iri("OnBlank"), managed);

const rows = async (kind: "class" | "shape", subject: NamedNode | BlankNode, origin = "managed") =>
  (
    await select(shaclRules, store, {
      subject,
      kind: factory.literal(kind),
      dataModel: managed,
      origin: factory.literal(origin),
    })
  ).map(({ shape, rule, label }) => ({
    shape: shape.value.replace("http://example.org/", ""),
    rule: rule.value.replace("http://example.org/", ""),
    label: label?.value,
  }));

test("shape: rules in sh:order", async () => {
  expect(await rows("shape", iri("PersonShape"))).toEqual([
    { shape: "PersonShape", rule: "RuleB", label: undefined },
    { shape: "PersonShape", rule: "RuleA", label: "Rule A" },
  ]);
});

test("class: the rules of every shape of the origin targeting it", async () => {
  expect((await rows("class", iri("Person"))).map((row) => row.rule)).toEqual(["RuleB", "RuleA"]);
  expect((await rows("class", iri("Person"), "imported")).map((row) => row.rule)).toEqual([
    "ImportedRule",
  ]);
});

test("shape: a blank-node shape", async () => {
  expect((await rows("shape", blankShape)).map((row) => row.rule)).toEqual(["OnBlank"]);
});
