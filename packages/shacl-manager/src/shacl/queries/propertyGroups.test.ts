import type { NamedNode } from "@rdfjs/types";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { select } from "@shapething/shacl-renderer";
import propertyGroups from "./propertyGroups.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const rdfType = factory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const sh = (local: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${local}`);
const integer = (value: number) =>
  factory.literal(String(value), factory.namedNode("http://www.w3.org/2001/XMLSchema#integer"));

const managed = iri("managed");
const imported = iri("imported");

type GroupSpec = { graph: NamedNode; properties?: number; order?: number; typed?: boolean };
const group = (name: string, { graph, properties = 0, order, typed = true }: GroupSpec) => [
  ...(typed ? [factory.quad(iri(name), rdfType, sh("PropertyGroup"), graph)] : []),
  ...(order === undefined ? [] : [factory.quad(iri(name), sh("order"), integer(order), graph)]),
  ...Array.from({ length: properties }, (_, index) =>
    factory.quad(iri(`${name}-p${index}`), sh("group"), iri(name), graph),
  ),
];

const store = RdfStore.createDefault();
for (const quad of [
  ...group("Contact", { graph: managed, properties: 1, order: 2 }),
  ...group("General", { graph: managed, properties: 0, order: 1 }),
  ...group("Extra", { graph: managed, properties: 3 }),
  // Never declared, only used by a property shape: still a group.
  ...group("Undeclared", { graph: managed, properties: 1, typed: false }),
  ...group("Metadata", { graph: imported, properties: 2 }),
]) {
  store.addQuad(quad);
}

const rows = async (origin: "managed" | "imported") =>
  (
    await select(propertyGroups, store, { dataModel: managed, origin: factory.literal(origin) })
  ).map(({ group, propertyCount }) => [
    group.value.replace("http://example.org/", ""),
    Number(propertyCount.value),
  ]);

test("managed: by sh:order, then most property shapes first", async () => {
  expect(await rows("managed")).toEqual([
    ["General", 0],
    ["Contact", 1],
    ["Extra", 3],
    ["Undeclared", 1],
  ]);
});

test("imported origin", async () => {
  expect(await rows("imported")).toEqual([["Metadata", 2]]);
});
