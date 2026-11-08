import { expect, test } from "vite-plus/test";
import { createInfluenceScale, relativeInfluence } from "./influenceScale.ts";

test("the scale keeps distinct counts, ascending", () => {
  expect(createInfluenceScale([5, 1, 5, 3]).counts).toEqual([1, 3, 5]);
});

test("a count ranks from 0 (the lowest) to 100 (the highest)", () => {
  const scale = createInfluenceScale([1, 3, 5]);
  expect(relativeInfluence(scale, 1)).toBe(0);
  expect(relativeInfluence(scale, 3)).toBe(50);
  expect(relativeInfluence(scale, 5)).toBe(100);
});

test("a ranking is not flattened by one very large count", () => {
  const scale = createInfluenceScale([1, 2, 3, 10_000]);
  expect(relativeInfluence(scale, 3)).toBe(67);
});

test("without at least two counts there is nothing to compare with", () => {
  expect(relativeInfluence(createInfluenceScale([]), 4)).toBeUndefined();
  expect(relativeInfluence(createInfluenceScale([4, 4]), 4)).toBeUndefined();
});

test("a count above the scale is the highest", () => {
  expect(relativeInfluence(createInfluenceScale([1, 2]), 50)).toBe(100);
});
