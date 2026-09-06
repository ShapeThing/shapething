import type { Literal, Term } from "@rdfjs/types";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import { parse as parseWkt } from "wkt";
import { geosparql, st } from "@/helpers/namespaces.ts";
import {
  propertyPathsByRole,
  valueNodeClassification,
  valueNodeLabel,
} from "@/resolution/label.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { BCP47 } from "@/types/BCP47.ts";

// "FeatureCollection" deliberately excluded - a single RDF value maps to a single feature in this
// widget's model, and a FeatureCollection has no single Geometry to hang onto a Feature anyway.
const GEOJSON_TYPES = new Set([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
  "Feature",
]);

function parseJsonGeometry(value: string): Feature | Geometry | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  const type = (parsed as { type?: unknown } | null)?.type;
  return typeof type === "string" && GEOJSON_TYPES.has(type)
    ? (parsed as Feature | Geometry)
    : undefined;
}

// A value literal directly typed as a GeoSPARQL WKT literal, or - falling back for a plain string/
// custom datatype - one whose lexical value happens to parse as GeoJSON text.
function literalToGeometry(term: Term): Feature | Geometry | undefined {
  if (term.termType !== "Literal") return undefined;
  if (term.datatype.equals(geosparql("wktLiteral"))) {
    try {
      return parseWkt(term.value) ?? undefined;
    } catch {
      return undefined;
    }
  }
  return parseJsonGeometry(term.value);
}

// One hop into `row`'s own properties, for the common case where a property's value is a Feature/
// geometry IRI or blank node rather than the geo literal itself. Which property that is gets
// declared explicitly by the shape author via `shui:propertyRole st:GeoRole` on a property shape
// under `row`'s own sh:node (or sh:class-targeted) shape - a ShapeThing-original addition to the
// spec's own Property Roles mechanism (resolution/label.ts's labelRolePropertyPaths/
// depictionRolePropertyPaths are the shui:LabelRole/DepictionRole siblings this mirrors), rather
// than guessing from well-known predicate names.
function geoRoleGeometry(shape: PropertyUIElement, row: Term): Feature | Geometry | undefined {
  const value = propertyPathsByRole(shape, st("GeoRole"))
    .flatMap((path) => walkPropertyPath(path, row, shape.dataGraph))
    .find((candidate): candidate is Literal => candidate.termType === "Literal");
  return value && literalToGeometry(value);
}

// Tooltip content for `row`, via the same shui:LabelRole/ClassificationRole roles ValueTableViewer's
// cells and LabelViewer already resolve through (see resolution/label.ts) - undefined for a literal
// row, since the property's value IS the geometry then, with no separate node to hang a title/
// classification off of.
function tooltipProperties(
  shape: PropertyUIElement,
  row: Term,
  languages: BCP47[],
): GeoJsonProperties {
  if (row.termType !== "NamedNode" && row.termType !== "BlankNode") return null;
  const title = valueNodeLabel({ term: row, propertyShape: shape, languages }).value;
  const classification = valueNodeClassification({
    term: row,
    propertyShape: shape,
    languages,
  })?.label;
  return classification ? { title, classification } : { title };
}

function toFeature(geometry: Feature | Geometry, properties: GeoJsonProperties): Feature {
  return geometry.type === "Feature"
    ? { ...geometry, properties: { ...geometry.properties, ...properties } }
    : { type: "Feature", geometry, properties };
}

/**
 * Resolves one of this property's values into a GeoJSON Feature, trying every representation this
 * viewer understands in turn: a WKT or GeoJSON literal directly on the value, or - when the value
 * is an IRI/blank node instead - one hop into its own properties via st:GeoRole (see
 * geoRoleGeometry). Returns undefined when neither applies. The feature's own properties carry
 * this value's tooltip content (see tooltipProperties) for the popup widget.tsx shows on hover.
 */
export function valueToFeature(
  shape: PropertyUIElement,
  row: Term,
  languages: BCP47[],
): Feature | undefined {
  const geometry = literalToGeometry(row) ?? geoRoleGeometry(shape, row);
  return geometry && toFeature(geometry, tooltipProperties(shape, row, languages));
}

function extendBounds(bounds: [number, number, number, number], position: number[]): void {
  bounds[0] = Math.min(bounds[0], position[0]);
  bounds[1] = Math.min(bounds[1], position[1]);
  bounds[2] = Math.max(bounds[2], position[0]);
  bounds[3] = Math.max(bounds[3], position[1]);
}

// Coordinates nest to varying depths depending on geometry type (a Point's is a single position, a
// MultiPolygon's is positions nested three deep) - so rather than a bbox-per-type helper, walk
// arbitrarily deep and treat the first array-of-numbers found as a position.
function walkCoordinates(value: unknown, bounds: [number, number, number, number]): void {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number") {
    extendBounds(bounds, value as number[]);
    return;
  }
  for (const item of value) walkCoordinates(item, bounds);
}

// GeometryCollection has no `coordinates` of its own - recurse into its members instead. Kept
// separate from walkCoordinates() so that function can stay about array shape, not GeoJSON shape.
function walkGeometry(geometry: Geometry, bounds: [number, number, number, number]): void {
  if (geometry.type === "GeometryCollection") {
    for (const inner of geometry.geometries) walkGeometry(inner, bounds);
  } else {
    walkCoordinates(geometry.coordinates, bounds);
  }
}

/**
 * The bounding box `[minLng, minLat, maxLng, maxLat]` covering every feature's coordinates, for
 * fitBounds() - undefined when the collection has no features (nothing to fit to). A small local
 * substitute for @turf/turf's bbox(), which this widget doesn't otherwise need.
 */
export function featureCollectionBounds(
  collection: FeatureCollection,
): [number, number, number, number] | undefined {
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of collection.features) walkGeometry(feature.geometry, bounds);
  return Number.isFinite(bounds[0]) ? bounds : undefined;
}
