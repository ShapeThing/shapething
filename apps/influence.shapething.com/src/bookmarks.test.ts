import { expect, test } from "vite-plus/test";
import { parse } from "./bookmarks.ts";

test("the bookmarks are the paths in the stored array", () => {
  expect(parse('["/Q859","/Q859,Q868"]')).toEqual(["/Q859", "/Q859,Q868"]);
});

test("what is not a path is left out", () => {
  expect(parse('["/Q859",3,null]')).toEqual(["/Q859"]);
});

test("anything else stored is no bookmarks", () => {
  expect(parse("{}")).toEqual([]);
  expect(parse("not json")).toEqual([]);
});
