import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { geosparql } from "@/helpers/namespaces.ts";
import { canonicalWktValue, geometryToLiteral, termToFeature } from "./geometry.ts";

test("termToFeature() parses a GeoSPARQL WKT literal into a Point feature carrying the given id", () => {
  const term = factory.literal("POINT (4.9041 52.3676)", geosparql("wktLiteral"));
  expect(termToFeature(term, "id-1")).toEqual({
    type: "Feature",
    id: "id-1",
    geometry: { type: "Point", coordinates: [4.9041, 52.3676] },
    properties: {},
  });
});

test("termToFeature() falls back to sniffing a plain string literal as GeoJSON text", () => {
  const term = factory.literal('{"type": "Point", "coordinates": [4.8952, 52.3702]}');
  expect(termToFeature(term, "id-1")).toEqual({
    type: "Feature",
    id: "id-1",
    geometry: { type: "Point", coordinates: [4.8952, 52.3702] },
    properties: {},
  });
});

test("termToFeature() returns undefined for a literal that is neither WKT nor GeoJSON", () => {
  expect(termToFeature(factory.literal("just some text"), "id-1")).toBeUndefined();
});

test("termToFeature() returns undefined for invalid WKT text", () => {
  const term = factory.literal("NOT WKT AT ALL", geosparql("wktLiteral"));
  expect(termToFeature(term, "id-1")).toBeUndefined();
});

test("termToFeature() returns undefined for a non-literal value (e.g. an IRI)", () => {
  expect(termToFeature(factory.namedNode("http://example.org/somewhere"), "id-1")).toBeUndefined();
});

test("geometryToLiteral() stringifies a Point feature into a GeoSPARQL WKT literal", () => {
  const literal = geometryToLiteral({
    type: "Feature",
    geometry: { type: "Point", coordinates: [4.9041, 52.3676] },
    properties: {},
  });
  expect(literal?.value).toBe("POINT (4.9041 52.3676)");
  expect(literal?.datatype.value).toBe(geosparql("wktLiteral").value);
});

test("geometryToLiteral() stringifies a Polygon feature", () => {
  const literal = geometryToLiteral({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    properties: {},
  });
  expect(literal?.value).toBe("POLYGON ((0 0, 1 0, 1 1, 0 0))");
});

test("termToFeature() and geometryToLiteral() round-trip a WKT literal", () => {
  const original = factory.literal("LINESTRING (0 0, 1 1)", geosparql("wktLiteral"));
  const feature = termToFeature(original, "id-1");
  expect(feature).toBeDefined();
  const literal = geometryToLiteral(feature!);
  expect(literal?.value).toBe(original.value);
});

test("canonicalWktValue() normalizes a differently-formatted but equivalent WKT literal to the same text a freshly-drawn feature would stringify to", () => {
  // wkt's own stringify() never emits trailing zeros - a literal written with them (e.g. by
  // another tool, or hand-authored) must still compare equal to a map feature at the same
  // position, or syncFromEditor would treat this untouched value as changed on every sync.
  const term = factory.literal("POINT (4.9041 52.3600)", geosparql("wktLiteral"));
  expect(canonicalWktValue(term)).toBe("POINT (4.9041 52.36)");
});

test("canonicalWktValue() returns undefined for a value this editor doesn't understand as geometry", () => {
  expect(canonicalWktValue(factory.literal("just some text"))).toBeUndefined();
});
