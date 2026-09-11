import type { Literal, Term } from "@rdfjs/types";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { stringify as stringifyWkt } from "wkt";
import { factory } from "@/helpers/factory.ts";
import { literalToGeometry } from "@/helpers/geometryLiteral.ts";
import { geosparql } from "@/helpers/namespaces.ts";

/**
 * Every value this property actually has (structure/facetValues.ts's aggregateFacetValues),
 * resolved to a GeoJSON Feature for plotting on the map - values this widget doesn't recognize as
 * geometry (see helpers/geometryLiteral.ts's literalToGeometry) are silently dropped. The facet-mode
 * analogue of MapViewer/geometry.ts's own valueToFeature, minus the st:GeoRole one-hop fallback:
 * facet mode has no single row/shape context to walk a nested property from, only the raw
 * aggregated value itself.
 */
export function valuesToFeatureCollection(values: Term[]): FeatureCollection {
  const features = values
    .map((value) => literalToGeometry(value))
    .filter((geometry): geometry is NonNullable<typeof geometry> => geometry !== undefined)
    .map(
      (geometry): Feature =>
        geometry.type === "Feature" ? geometry : { type: "Feature", geometry, properties: null },
    );
  return { type: "FeatureCollection", features };
}

/**
 * The FeatureCollection to preload into the draw editor for an existing st:withinArea constraint
 * value (see structure/filterShape.ts) - unwraps a MultiPolygon into one Polygon feature per member,
 * since that's the shape drawnFeaturesToAreaLiteral below builds it back up from, and geoman's
 * editor (like GeoEditor's own termToFeature/syncFromEditor) works in terms of individual features,
 * not one combined multi-geometry.
 */
export function areaLiteralToFeatureCollection(literal: Term | undefined): FeatureCollection {
  const parsed = literal && literalToGeometry(literal);
  const geometry = parsed?.type === "Feature" ? parsed.geometry : parsed;
  const polygons: Position[][][] =
    geometry?.type === "MultiPolygon"
      ? geometry.coordinates
      : geometry?.type === "Polygon"
        ? [geometry.coordinates]
        : [];

  return {
    type: "FeatureCollection",
    features: polygons.map(
      (coordinates, index): Feature => ({
        type: "Feature",
        id: index,
        geometry: { type: "Polygon", coordinates },
        properties: {},
      }),
    ),
  };
}

/**
 * The write side: every polygon the user currently has drawn, combined into one MultiPolygon
 * st:withinArea literal (see structure/filterShape.ts) - undefined once nothing is drawn
 * (setConstraint then clears the constraint entirely, the same "no value" convention every other
 * facet widget follows). Non-polygon features (there shouldn't be any - see widget.tsx's own
 * drawModes, restricted to rectangle/polygon) are silently ignored rather than rejecting the whole
 * selection.
 */
export function drawnFeaturesToAreaLiteral(collection: FeatureCollection): Literal | undefined {
  const polygons = collection.features
    .map((feature) => feature.geometry)
    .filter((geometry): geometry is Polygon => geometry.type === "Polygon")
    .map((geometry) => geometry.coordinates);
  if (polygons.length === 0) return undefined;

  const multiPolygon: MultiPolygon = { type: "MultiPolygon", coordinates: polygons };
  try {
    return factory.literal(stringifyWkt(multiPolygon), geosparql("wktLiteral"));
  } catch {
    return undefined;
  }
}
