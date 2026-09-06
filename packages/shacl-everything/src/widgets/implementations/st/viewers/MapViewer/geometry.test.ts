import type { FeatureCollection } from "geojson";
import { expect, test } from "vite-plus/test";
import { factory } from "@/helpers/factory.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { ex, geosparql, queryPrefixes } from "@/helpers/namespaces.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { featureCollectionBounds, valueToFeature } from "./geometry.ts";

const createShape = async (shapesTurtle: string, dataTurtle = "") => {
  const shapesGraph = await parseRdf(`${queryPrefixes}\n\n${shapesTurtle}`, "text/turtle");
  const dataGraph = await parseRdf(`${queryPrefixes}\n\n${dataTurtle}`, "text/turtle");
  return new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode: ex("Subject"),
    propertyShapes: [ex("property1")],
  });
};

test("valueToFeature() parses a GeoSPARQL WKT literal into a Point feature", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:path ex:location .`);
  const term = factory.literal("POINT (4.9041 52.3676)", geosparql("wktLiteral"));

  expect(valueToFeature(shape, term, ["en-GB"])).toEqual({
    type: "Feature",
    geometry: { type: "Point", coordinates: [4.9041, 52.3676] },
    properties: null,
  });
});

test("valueToFeature() falls back to sniffing a plain string literal as GeoJSON text", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:path ex:location .`);
  const term = factory.literal('{"type": "Point", "coordinates": [4.8952, 52.3702]}');

  expect(valueToFeature(shape, term, ["en-GB"])).toEqual({
    type: "Feature",
    geometry: { type: "Point", coordinates: [4.8952, 52.3702] },
    properties: null,
  });
});

test("valueToFeature() returns undefined for a literal that is neither WKT nor GeoJSON", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:path ex:location .`);
  expect(valueToFeature(shape, factory.literal("just some text"), ["en-GB"])).toBeUndefined();
});

test("valueToFeature() returns undefined for invalid WKT text", async () => {
  const shape = await createShape(`ex:property1 a sh:PropertyShape ; sh:path ex:location .`);
  const term = factory.literal("NOT WKT AT ALL", geosparql("wktLiteral"));
  expect(valueToFeature(shape, term, ["en-GB"])).toBeUndefined();
});

test("valueToFeature() walks one hop into an IRI value's own st:GeoRole property, falling back to its local name as the tooltip title", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:path ex:location ; sh:node ex:GeometryShape .
      ex:GeometryShape a sh:NodeShape ;
        sh:property [ sh:path geosparql:asWKT ; shui:propertyRole st:GeoRole ] .
    `,
    `
      ex:Subject ex:location ex:geometry1 .
      ex:geometry1 geosparql:asWKT "POINT (5 52)"^^geosparql:wktLiteral .
    `,
  );

  expect(valueToFeature(shape, ex("geometry1"), ["en-GB"])).toEqual({
    type: "Feature",
    geometry: { type: "Point", coordinates: [5, 52] },
    properties: { title: "geometry1" },
  });
});

test("valueToFeature() resolves tooltip title/classification via shui:LabelRole/ClassificationRole alongside st:GeoRole", async () => {
  const shape = await createShape(
    `
      ex:property1 a sh:PropertyShape ; sh:path ex:location ; sh:node ex:PlaceShape .
      ex:PlaceShape a sh:NodeShape ;
        sh:property [ sh:path geosparql:asWKT ; shui:propertyRole st:GeoRole ] ;
        sh:property [ sh:path ex:name ; shui:propertyRole shui:LabelRole ] ;
        sh:property [ sh:path ex:kind ; shui:propertyRole shui:ClassificationRole ] .
    `,
    `
      ex:Subject ex:location ex:place1 .
      ex:place1 geosparql:asWKT "POINT (5 52)"^^geosparql:wktLiteral ;
        ex:name "Amsterdam" ;
        ex:kind "City" .
    `,
  );

  expect(valueToFeature(shape, ex("place1"), ["en-GB"])).toEqual({
    type: "Feature",
    geometry: { type: "Point", coordinates: [5, 52] },
    properties: { title: "Amsterdam", classification: "City" },
  });
});

test("valueToFeature() returns undefined for an IRI value with no matching st:GeoRole property", async () => {
  const shape = await createShape(
    `ex:property1 a sh:PropertyShape ; sh:path ex:location .`,
    `ex:Subject ex:location ex:somewhere .`,
  );

  expect(valueToFeature(shape, ex("somewhere"), ["en-GB"])).toBeUndefined();
});

test("featureCollectionBounds() returns undefined for an empty collection", () => {
  expect(featureCollectionBounds({ type: "FeatureCollection", features: [] })).toBeUndefined();
});

test("featureCollectionBounds() covers every feature's coordinates, including a GeometryCollection's nested members", () => {
  const collection: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [5, 52] }, properties: {} },
      {
        type: "Feature",
        geometry: {
          type: "GeometryCollection",
          geometries: [{ type: "Point", coordinates: [10, 40] }],
        },
        properties: {},
      },
    ],
  };

  expect(featureCollectionBounds(collection)).toEqual([5, 40, 10, 52]);
});
