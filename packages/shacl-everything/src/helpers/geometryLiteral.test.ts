import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { geosparql, xsd } from "@/helpers/namespaces.ts";
import { geometryIntersectsArea, literalToGeometry } from "./geometryLiteral.ts";

test("literalToGeometry: parses a GeoSPARQL WKT Point literal", () => {
  const geometry = literalToGeometry(
    factory.literal("POINT (2.3522 48.8566)", geosparql("wktLiteral")),
  );

  expect(geometry).toEqual({ type: "Point", coordinates: [2.3522, 48.8566] });
});

test("literalToGeometry: falls back to parsing a plain string as GeoJSON text", () => {
  const geometry = literalToGeometry(
    factory.literal('{"type": "Point", "coordinates": [4.9, 52.4]}', xsd("string")),
  );

  expect(geometry).toEqual({ type: "Point", coordinates: [4.9, 52.4] });
});

test("literalToGeometry: undefined for a literal that is neither WKT nor recognizable GeoJSON", () => {
  expect(literalToGeometry(factory.literal("just some text", xsd("string")))).toBeUndefined();
});

test("literalToGeometry: undefined for a non-literal term", () => {
  expect(literalToGeometry(factory.namedNode("http://example.org/thing"))).toBeUndefined();
});

const europeRectangle = "POLYGON ((-10 35, 20 35, 20 60, -10 60, -10 35))";

test("geometryIntersectsArea: a Point inside the polygon matches", () => {
  const paris = literalToGeometry(factory.literal("POINT (2.35 48.85)", geosparql("wktLiteral")))!;
  const area = literalToGeometry(factory.literal(europeRectangle, geosparql("wktLiteral")))!;

  expect(geometryIntersectsArea(paris, area)).toBe(true);
});

test("geometryIntersectsArea: a Point outside the polygon does not match", () => {
  const tokyo = literalToGeometry(
    factory.literal("POINT (139.69 35.68)", geosparql("wktLiteral")),
  )!;
  const area = literalToGeometry(factory.literal(europeRectangle, geosparql("wktLiteral")))!;

  expect(geometryIntersectsArea(tokyo, area)).toBe(false);
});

test("geometryIntersectsArea: a Polygon value matches if any of its own vertices falls inside the selection", () => {
  // A small polygon straddling the edge of the selection rectangle - one vertex inside, one out.
  const value = literalToGeometry(
    factory.literal("POLYGON ((15 40, 25 40, 25 50, 15 50, 15 40))", geosparql("wktLiteral")),
  )!;
  const area = literalToGeometry(factory.literal(europeRectangle, geosparql("wktLiteral")))!;

  expect(geometryIntersectsArea(value, area)).toBe(true);
});

test("geometryIntersectsArea: a MultiPolygon selection matches if any of its member polygons contains the point", () => {
  const tokyo = literalToGeometry(
    factory.literal("POINT (139.69 35.68)", geosparql("wktLiteral")),
  )!;
  const area = literalToGeometry(
    factory.literal(
      "MULTIPOLYGON (((-10 35, 20 35, 20 60, -10 60, -10 35)), ((120 20, 150 20, 150 45, 120 45, 120 20)))",
      geosparql("wktLiteral"),
    ),
  )!;

  expect(geometryIntersectsArea(tokyo, area)).toBe(true);
});

test("geometryIntersectsArea: a non-polygon selection (e.g. a bare Point) matches nothing", () => {
  const paris = literalToGeometry(factory.literal("POINT (2.35 48.85)", geosparql("wktLiteral")))!;
  const area = literalToGeometry(factory.literal("POINT (0 0)", geosparql("wktLiteral")))!;

  expect(geometryIntersectsArea(paris, area)).toBe(false);
});
