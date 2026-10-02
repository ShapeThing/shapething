import { describe, expect, it } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import {
  removeAt,
  updateAt,
  withItemInserted,
  withMoved,
  withStepAround,
} from "./mutation-logic.ts";

const p = (name: string): PropertyPath => ({
  type: "predicate",
  predicate: factory.namedNode(`http://example.org/${name}`),
});
const seq = (...items: PropertyPath[]): PropertyPath => ({ type: "sequence", items });
const alt = (...items: PropertyPath[]): PropertyPath => ({ type: "alternative", items });
const inv = (path: PropertyPath): PropertyPath => ({ type: "inverse", path });

describe("removeAt", () => {
  it("collapses a list left with one item", () => {
    expect(removeAt(alt(p("a"), p("b")), [0])).toEqual(p("b"));
  });

  it("takes a wrapper along with its only child", () => {
    expect(removeAt(seq(p("a"), inv(p("b")), p("c")), [1, "path"])).toEqual(seq(p("a"), p("c")));
  });

  it("empties the value when the root goes", () => {
    expect(removeAt(inv(p("a")), ["path"])).toBeNull();
  });
});

describe("withMoved", () => {
  it("moves a step later in the same sequence, keeping the target index valid", () => {
    const root = seq(p("a"), p("b"), p("c"));
    const moved = withMoved(root, [0], (tree, item) =>
      updateAt(tree, [], (s) => withItemInserted(s as never, 3, item)),
    );
    expect(moved).toEqual(seq(p("b"), p("c"), p("a")));
  });

  it("moves a node out of a wrapper, removing the emptied wrapper", () => {
    const root = seq(inv(p("a")), p("b"));
    const moved = withMoved(root, [0, "path"], (tree, item) =>
      updateAt(tree, [1], (b) => withStepAround(b, item, "after")),
    );
    expect(moved).toEqual(seq(p("b"), p("a")));
  });

  it("moves a whole container into a sibling branch", () => {
    const root = alt(seq(p("a"), p("b")), p("c"), p("d"));
    const moved = withMoved(root, [0], (tree, item) =>
      updateAt(tree, [2], (d) => withStepAround(d, item, "before")),
    );
    expect(moved).toEqual(alt(p("c"), seq(p("a"), p("b"), p("d"))));
  });
});
