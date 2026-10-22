import { describe, expect, it } from "vitest";
import type { Term } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";
import { blank, ex, list, storeOf } from "@/helpers/testing.ts";
import { buildPropertyIndex } from "@/ontology/model.ts";
import { buildPropertyShapes } from "@/shapes/model.ts";
import { describePath } from "@/shapes/paths.ts";
import { alignProperties, groupByOrigin } from "./model.ts";

const owlObjectProperty = factory.namedNode("http://www.w3.org/2002/07/owl#ObjectProperty");

const properties = buildPropertyIndex([
  { property: ex("name"), type: owlObjectProperty, domain: ex("Dog") },
  { property: ex("broader"), type: owlObjectProperty, domain: ex("Dog") },
  { property: ex("label"), type: owlObjectProperty },
  { property: ex("legs"), type: owlObjectProperty, domain: ex("Animal") },
  { property: ex("owner"), type: owlObjectProperty, domain: ex("Dog") },
]);

// sh:path ( ex:broader ex:label )
const sequence = list([ex("broader"), ex("label")], "seq");
const store = storeOf(...sequence.triples, [blank("unused"), sh("path"), sequence.head]);
const describe_ = (path: Term) => describePath(store, path);

const shapes = buildPropertyShapes([
  { owner: ex("DogShape"), propertyShape: ex("ps-name"), path: ex("name") },
  { owner: ex("DogShape"), propertyShape: ex("ps-broaderLabel"), path: sequence.head },
  { owner: ex("DogShape"), propertyShape: ex("ps-local"), path: ex("notInOntology") },
]).get(ex("DogShape").value)!;

describe("alignProperties", () => {
  const rows = alignProperties(
    shapes.map((propertyShape) => ({ propertyShape, origin: { kind: "defined" as const } })),
    [ex("Dog"), ex("Animal")],
    properties,
    describe_,
  );
  const summary = rows.map((row) => [
    row.key.split("/").pop(),
    row.kind,
    row.owlProperties.map((p) => p.iri.split("/").pop()),
  ]);

  it("merges a plain predicate path with its OWL property", () => {
    expect(summary).toContainEqual(["ps-name", "merged", ["name"]]);
  });

  it("keeps a complex path over OWL properties split, listing each property", () => {
    expect(summary).toContainEqual(["ps-broaderLabel", "split", ["broader", "label"]]);
  });

  it("keeps a property shape outside the ontology SHACL-only", () => {
    expect(summary).toContainEqual(["ps-local", "shape", []]);
  });

  it("adds uncovered OWL properties in domain scope, focus class first", () => {
    expect(summary.filter(([, kind]) => kind === "ontology")).toEqual([
      ["owner", "ontology", ["owner"]],
      ["legs", "ontology", ["legs"]],
    ]);
  });

  it("groups rows by origin in order of appearance", () => {
    expect(groupByOrigin(rows).map((group) => group.origin.kind)).toEqual([
      "defined",
      "domain",
      "domain",
    ]);
  });
});
