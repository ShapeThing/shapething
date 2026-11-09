import { expect, test } from "vite-plus/test";
import { parseSegment, segmentsFor, sortsFromSegments } from "./sorting.ts";

test("a segment is an identifier with the sort orders of the columns beside it", () => {
  expect(parseSegment("n:Q6512:b")).toEqual({ id: "Q6512", before: "name", after: "born" });
  expect(parseSegment("Q6512:n")).toEqual({ id: "Q6512", before: undefined, after: "name" });
});

test("old paths without sort orders still work", () => {
  expect(parseSegment("Q6512")).toEqual({ id: "Q6512", before: undefined, after: undefined });
  // A Wikipedia title of an older version of the app, a colon in it or not.
  expect(parseSegment("Søren_Kierkegaard")).toEqual({ id: "Søren_Kierkegaard" });
  expect(parseSegment("Star_Wars:_Episode_IV")).toEqual({ id: "Star_Wars:_Episode_IV" });
});

test("an unknown code is the default order", () => {
  expect(parseSegment("Q6512:z")).toEqual({ id: "Q6512", before: undefined, after: undefined });
});

test("the sort orders of a path, by column key", () => {
  const sorts = sortsFromSegments(["n:Q6512:b", "Q42156", "Q1:n"].map(parseSegment));
  expect([...sorts]).toEqual([
    ["influencers", "name"],
    ["Q6512", "born"],
    ["Q1", "name"],
  ]);
});

test("the segments of a chain carry the sort orders of its columns only", () => {
  const sorts = new Map([
    ["influencers", "name"],
    ["Q6512", "born"],
    ["Q999", "name"],
    ["Q42156", "influence"],
  ] as const);
  expect(segmentsFor(["Q6512", "Q42156"], sorts)).toEqual(["n:Q6512:b", "Q42156"]);
  expect(segmentsFor(["Q6512"], new Map())).toEqual(["Q6512"]);
});
