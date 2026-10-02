import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { geosparql, xsd } from "@/helpers/namespaces.ts";
import { literalToGeometry } from "./geometryLiteral.ts";

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
