import { describe, expect, it } from "vitest";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/testing.ts";
import {
  ancestorsOf,
  buildClassForest,
  buildClassIndex,
  buildPropertyIndex,
  pruneForest,
  type ClassTreeNode,
} from "./model.ts";

const rdfProperty = factory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#Property");

const local = (iri: string) => iri.split("/").pop()!;
const shape = (forest: ClassTreeNode[]): unknown =>
  forest.map((node) => ({ [local(node.owlClass.iri)]: shape(node.children) }));
const byIri = (c: { iri: string }) => c.iri;

// Animal <- Dog, Pet <- Dog (multiple inheritance), Thing alone
const index = buildClassIndex([
  { class: ex("Dog"), superClass: ex("Animal") },
  { class: ex("Dog"), superClass: ex("Pet") },
  { class: ex("Puppy"), superClass: ex("Dog") },
  { class: ex("Thing") },
]);

describe("buildClassIndex / ancestorsOf", () => {
  it("records parents and children, including classes only seen as a superclass", () => {
    expect([...index.keys()].sort()).toEqual(
      ["Animal", "Dog", "Pet", "Puppy", "Thing"].map((n) => ex(n).value),
    );
    expect([...index.get(ex("Animal").value)!.children]).toEqual([ex("Dog").value]);
  });

  it("lists ancestors nearest first, through every parent", () => {
    expect(ancestorsOf(index, ex("Puppy").value).map(local)).toEqual(["Dog", "Animal", "Pet"]);
  });

  it("terminates on subClassOf cycles and ignores self loops", () => {
    const cyclic = buildClassIndex([
      { class: ex("A"), superClass: ex("B") },
      { class: ex("B"), superClass: ex("A") },
      { class: ex("C"), superClass: ex("C") },
    ]);
    expect(ancestorsOf(cyclic, ex("A").value).map(local)).toEqual(["B"]);
    expect(cyclic.get(ex("C").value)!.parents.size).toBe(0);
  });
});

describe("buildClassForest", () => {
  it("duplicates a class under each of its superclasses", () => {
    expect(shape(buildClassForest(index, byIri))).toEqual([
      { Animal: [{ Dog: [{ Puppy: [] }] }] },
      { Pet: [{ Dog: [{ Puppy: [] }] }] },
      { Thing: [] },
    ]);
  });

  it("restricts to an include set, promoting classes whose parents are excluded", () => {
    const include = new Set([ex("Dog").value, ex("Animal").value]);
    expect(shape(buildClassForest(index, byIri, include))).toEqual([{ Animal: [{ Dog: [] }] }]);
    expect(shape(buildClassForest(index, byIri, new Set([ex("Puppy").value])))).toEqual([
      { Puppy: [] },
    ]);
  });

  it("still shows the members of a pure cycle", () => {
    const cyclic = buildClassIndex([
      { class: ex("A"), superClass: ex("B") },
      { class: ex("B"), superClass: ex("A") },
    ]);
    expect(shape(buildClassForest(cyclic, byIri))).toEqual([{ A: [{ B: [] }] }]);
  });
});

describe("pruneForest", () => {
  it("lifts kept descendants of dropped classes", () => {
    const kept = new Set([ex("Puppy").value, ex("Pet").value]);
    expect(shape(pruneForest(buildClassForest(index, byIri), (c) => kept.has(c.iri)))).toEqual([
      { Puppy: [] },
      { Pet: [{ Puppy: [] }] },
    ]);
  });
});

describe("buildPropertyIndex", () => {
  it("collects types, domains and ranges per property", () => {
    const properties = buildPropertyIndex([
      {
        property: ex("name"),
        type: rdfProperty,
        domain: ex("Dog"),
        range: ex("Text"),
      },
      { property: ex("name"), type: rdfProperty, domain: ex("Pet") },
    ]);
    const name = properties.get(ex("name").value)!;
    expect([...name.domains].map(local)).toEqual(["Dog", "Pet"]);
    expect([...name.ranges].map(local)).toEqual(["Text"]);
  });
});
