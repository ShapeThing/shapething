import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { geosparqlExtensionFunctions } from "@/helpers/geosparqlFunctions.ts";
import { geof, geosparql, xsd } from "@/helpers/namespaces.ts";

const wkt = (value: string) => factory.literal(value, geosparql("wktLiteral"));

const europeRectangle = wkt("POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))");
const paris = wkt("POINT (2.35 48.85)");
const tokyo = wkt("POINT (139.69 35.68)");

test("geof:sfWithin is registered under its full IRI and true booleans a Point inside the polygon", async () => {
  const sfWithin = geosparqlExtensionFunctions[geof("sfWithin").value];
  expect(await sfWithin([paris, europeRectangle])).toEqual(factory.literal("true", xsd("boolean")));
});

test("geof:sfWithin is false for a Point outside the polygon", async () => {
  const sfWithin = geosparqlExtensionFunctions[geof("sfWithin").value];
  expect(await sfWithin([tokyo, europeRectangle])).toEqual(factory.literal("false", xsd("boolean")));
});

test("geof:sfContains is booleanWithin's inverse", async () => {
  const sfContains = geosparqlExtensionFunctions[geof("sfContains").value];
  expect(await sfContains([europeRectangle, paris])).toEqual(factory.literal("true", xsd("boolean")));
});

test("geof:sfIntersects/sfDisjoint/sfEquals/sfTouches/sfCrosses/sfOverlaps are all registered", async () => {
  for (const name of ["sfIntersects", "sfDisjoint", "sfEquals", "sfTouches", "sfCrosses", "sfOverlaps"]) {
    expect(geosparqlExtensionFunctions[geof(name).value]).toBeTypeOf("function");
  }
});

test("a relation is false, not thrown, for an argument that isn't a recognizable geometry", async () => {
  const sfWithin = geosparqlExtensionFunctions[geof("sfWithin").value];
  const notAGeometry = factory.literal("just some text", xsd("string"));
  expect(await sfWithin([notAGeometry, europeRectangle])).toEqual(factory.literal("false", xsd("boolean")));
});

test("a relation is false, not thrown, for a missing second argument", async () => {
  const sfWithin = geosparqlExtensionFunctions[geof("sfWithin").value];
  expect(await sfWithin([paris])).toEqual(factory.literal("false", xsd("boolean")));
});
