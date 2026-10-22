import { describe, expect, it } from "vitest";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/testing.ts";
import { buildClassIndex } from "@/ontology/model.ts";
import {
  buildNodeReferences,
  buildNodeShapeIndex,
  buildPropertyShapes,
  shapesByTargetClass,
} from "./model.ts";
import { resolveProperties, type ShapeGraph } from "./resolveProperties.ts";

const kind = (value: string) => factory.literal(value);

// DogShape -> Dog -> Animal <- AnimalShape; DogShape sh:node Named sh:node Ided sh:node Named (cycle)
function graph(): ShapeGraph {
  const nodeShapes = buildNodeShapeIndex([
    { shape: ex("DogShape"), targetKind: kind("class"), target: ex("Dog") },
    { shape: ex("AnimalShape"), targetKind: kind("class"), target: ex("Animal") },
    { shape: ex("Named") },
    { shape: ex("Ided") },
  ]);
  return {
    nodeShapes,
    classes: buildClassIndex([{ class: ex("Dog"), superClass: ex("Animal") }]),
    shapesByClass: shapesByTargetClass(nodeShapes),
    nodeReferences: buildNodeReferences([
      { shape: ex("DogShape"), node: ex("Named") },
      { shape: ex("Named"), node: ex("Ided") },
      { shape: ex("Ided"), node: ex("Named") },
    ]),
    propertyShapes: buildPropertyShapes([
      { owner: ex("DogShape"), propertyShape: ex("DogShape-breed"), path: ex("breed") },
      { owner: ex("Named"), propertyShape: ex("Named-name"), path: ex("name") },
      { owner: ex("Ided"), propertyShape: ex("Ided-id"), path: ex("id") },
      { owner: ex("AnimalShape"), propertyShape: ex("AnimalShape-legs"), path: ex("legs") },
      // Also reached via sh:node: the more specific origin wins.
      { owner: ex("AnimalShape"), propertyShape: ex("Named-name"), path: ex("name") },
    ]),
  };
}

describe("resolveProperties", () => {
  it("lists defined, sh:node and inherited property shapes once, most specific origin first", () => {
    const g = graph();
    const resolved = resolveProperties(g.nodeShapes.get(ex("DogShape").value)!, g);
    expect(
      resolved.map(({ propertyShape, origin }) => [
        propertyShape.key.split("/").pop(),
        origin.kind,
        origin.kind === "node"
          ? origin.via.value.split("/").pop()
          : origin.kind === "inherited"
            ? origin.owlClass.value.split("/").pop()
            : undefined,
      ]),
    ).toEqual([
      ["DogShape-breed", "defined", undefined],
      ["Named-name", "node", "Named"],
      ["Ided-id", "node", "Ided"],
      ["AnimalShape-legs", "inherited", "Animal"],
    ]);
  });
});
