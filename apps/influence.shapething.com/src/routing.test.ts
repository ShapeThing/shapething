import { expect, test } from "vite-plus/test";
import { entityModalHash, entityModalOf, idsFromPath, pathForIds } from "./routing.ts";

test("the path is the chain of identifiers", () => {
  expect(idsFromPath("/Q859,Q868")).toEqual(["Q859", "Q868"]);
  expect(pathForIds(["Q859", "Q868"])).toBe("/Q859,Q868");
});

test("the root path is an empty chain", () => {
  expect(idsFromPath("/")).toEqual([]);
});

test("empty parts are left out", () => {
  expect(idsFromPath("/Q859,,Q868,")).toEqual(["Q859", "Q868"]);
});

test("old paths with Wikipedia titles are decoded, a malformed one is kept as it is", () => {
  expect(idsFromPath("/S%C3%B8ren_Kierkegaard")).toEqual(["Søren_Kierkegaard"]);
  expect(idsFromPath("/100%_Plato")).toEqual(["100%_Plato"]);
});

test("sort orders in the path are not part of the identifiers", () => {
  expect(idsFromPath("/n:Q6512:b,Q42156:n")).toEqual(["Q6512", "Q42156"]);
  expect(pathForIds(["Q6512", "Q42156"], new Map([["Q6512", "born"]]))).toBe("/Q6512:b,Q42156");
});

test("the hash of an entity modal has its tab after the identifier, the first tab has none", () => {
  expect(entityModalOf("Q868")).toEqual({ id: "Q868", tab: "about" });
  expect(entityModalOf("Q868/works")).toEqual({ id: "Q868", tab: "works" });
  expect(entityModalOf("Q868/ideas")).toEqual({ id: "Q868", tab: "ideas" });
  expect(entityModalOf("Q868/interests")).toEqual({ id: "Q868", tab: "interests" });
  expect(entityModalHash("Q868")).toBe("#Q868");
  expect(entityModalHash("Q868", "works")).toBe("#Q868/works");
});

test("a hash that is not an entity is no entity modal", () => {
  expect(entityModalOf("info")).toBeUndefined();
  expect(entityModalOf("timeline")).toBeUndefined();
  // A tab the entity does not have shows its first tab (the renderer's fallback).
  expect(entityModalOf("Q868/nope")).toEqual({ id: "Q868", tab: "nope" });
  expect(entityModalOf("Q868/works/more")).toBeUndefined();
});
