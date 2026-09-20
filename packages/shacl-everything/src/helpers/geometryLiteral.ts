import type { Term } from "@rdfjs/types";
import type { Feature, Geometry } from "geojson";
import { parse as parseWkt } from "wkt";
import { geosparql } from "@/helpers/namespaces.ts";

// "FeatureCollection" deliberately excluded - a single RDF value maps to a single feature/geometry
// in every caller of literalToGeometry below, and a FeatureCollection has no single Geometry to
// hang onto anyway. Mirrors MapViewer/geometry.ts's own (now-removed, see that file) GEOJSON_TYPES.
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

/**
 * A value literal directly typed as a GeoSPARQL WKT literal, or - falling back for a plain string/
 * custom datatype - one whose lexical value happens to parse as GeoJSON text. Shared between
 * MapViewer (reading arbitrary shape-author data), MapFacet (plotting facet-aggregated values and
 * reading/writing a drawn selection area) and structure/facetValues.ts's own
 * countFacetInstancesWithinArea (evaluating a MapFacet selection's own spatial constraint - see
 * that function's own doc comment for why structure/filterShape.ts's own narrowing goes through
 * geof:sfWithin/Comunica instead, sharing the same underlying @turf/turf predicate rather than this
 * module) - one parsing rule for "is this term a geometry", kept in one place rather than
 * duplicated across widgets. GeoEditor/geometry.ts keeps its own narrower copy on purpose (see its
 * own comment) - it only ever round-trips what its own drawing toolbar can produce.
 */
export function literalToGeometry(term: Term): Feature | Geometry | undefined {
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

