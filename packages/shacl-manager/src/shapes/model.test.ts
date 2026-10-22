import { describe, expect, it } from "vitest";
import { factory } from "@/helpers/factory.ts";
import { blank, ex } from "@/helpers/testing.ts";
import {
  buildNodeShapeIndex,
  buildPropertyShapes,
  groupByTargeting,
  shapesByTargetClass,
} from "./model.ts";

const kind = (value: string) => factory.literal(value);
const int = (value: number) =>
  factory.literal(String(value), factory.namedNode("http://www.w3.org/2001/XMLSchema#integer"));

describe("buildNodeShapeIndex", () => {
  const index = buildNodeShapeIndex([
    { shape: ex("PersonShape"), targetKind: kind("class"), target: ex("Person") },
    { shape: ex("PersonShape"), targetKind: kind("node"), target: ex("alice") },
    { shape: ex("Person"), targetKind: kind("implicitClass"), target: ex("Person") },
    { shape: ex("HasNameShape"), targetKind: kind("subjectsOf"), target: ex("name") },
    { shape: ex("Helper") },
    { shape: ex("PersonShape") },
  ]);

  it("collects every target of a shape once", () => {
    expect(index.get(ex("PersonShape").value)!.targets.map((t) => t.kind)).toEqual([
      "class",
      "node",
    ]);
    expect(index.get(ex("Helper").value)!.targets).toEqual([]);
  });

  it("indexes explicit and implicit class targets per class", () => {
    const shapes = shapesByTargetClass(index).get(ex("Person").value)!;
    expect(shapes.map((s) => s.key)).toEqual([ex("PersonShape").value, ex("Person").value]);
  });

  it("groups the other targeting methods, listing multi-target shapes in each", () => {
    const groups = groupByTargeting(index);
    expect(groups.node.map((s) => s.key)).toEqual([ex("PersonShape").value]);
    expect(groups.subjectsOf.map((s) => s.key)).toEqual([ex("HasNameShape").value]);
    expect(groups.none.map((s) => s.key)).toEqual([ex("Helper").value]);
  });
});

describe("buildPropertyShapes", () => {
  it("dedupes rows per property shape, keeps first values and sorts by sh:order", () => {
    const byOwner = buildPropertyShapes([
      { owner: ex("S"), propertyShape: blank("b"), path: ex("b"), order: int(2) },
      { owner: ex("S"), propertyShape: ex("a"), path: ex("a"), order: int(1), minCount: int(1) },
      { owner: ex("S"), propertyShape: ex("a"), path: ex("a"), order: int(1), minCount: int(5) },
    ]);
    const shapes = byOwner.get(ex("S").value)!;
    expect(shapes.map((s) => s.key)).toEqual([ex("a").value, "_:b"]);
    expect(shapes[0].minCount).toBe(1);
  });
});
