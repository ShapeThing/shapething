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
 * reading/writing a drawn selection area) and structure/filterShape.ts (evaluating a MapFacet
 * selection's own spatial constraint) - one parsing rule for "is this term a geometry", kept in one
 * place rather than duplicated across widgets. GeoEditor/geometry.ts keeps its own narrower copy on
 * purpose (see its own comment) - it only ever round-trips what its own drawing toolbar can produce.
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

function collectPositions(value: unknown, positions: number[][]): void {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number") {
    positions.push(value as number[]);
    return;
  }
  for (const item of value) collectPositions(item, positions);
}

// Every [lng, lat] position nested anywhere inside `geometry`'s own coordinates, at whatever depth
// its type nests them (a Point's is a single position, a MultiPolygon's is nested three deep) - the
// same arbitrary-depth walk MapViewer/geometry.ts's own walkCoordinates uses to build a bounding
// box, reused here to build a flat position list instead.
function positionsOf(geometry: Geometry): number[][] {
  const positions: number[][] = [];
  if (geometry.type === "GeometryCollection") {
    for (const inner of geometry.geometries) positions.push(...positionsOf(inner));
  } else {
    collectPositions(geometry.coordinates, positions);
  }
  return positions;
}

// Every outer ring (the first, non-hole ring) of every polygon in `area` - a Polygon has one, a
// MultiPolygon one per member polygon. Holes are deliberately ignored: `area` is always a MapFacet
// user-drawn selection here, and geoman's rectangle/polygon draw modes never produce one with a hole.
function outerRings(area: Feature | Geometry): number[][][] {
  const geometry = area.type === "Feature" ? area.geometry : area;
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

// Ray-casting point-in-polygon test against a single linear ring (the standard even-odd crossing-
// number algorithm) - `ring` is a closed [lng, lat] loop (GeoJSON convention: first and last
// position equal).
function pointInRing(point: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > point[1] !== yj > point[1];
    if (crosses && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * True if any of `geometry`'s own coordinates falls within `area` (a Polygon/MultiPolygon,
 * typically a MapFacet user-drawn selection) - an approximation (a data polygon that merely
 * surrounds the selection area with no vertex of its own inside it would be missed) rather than a
 * full geometry-intersection test, the same tradeoff MapViewer/geometry.ts's own
 * featureCollectionBounds makes to avoid a @turf/turf dependency this codebase otherwise has no use
 * for. Good enough for a facet's "is this instance roughly in the selected area" filter. `area`
 * itself is never a Point/LineString - MapFacet only ever writes a Polygon/MultiPolygon selection -
 * so those simply match nothing (outerRings returns []).
 */
export function geometryIntersectsArea(geometry: Feature | Geometry, area: Feature | Geometry): boolean {
  const shape = geometry.type === "Feature" ? geometry.geometry : geometry;
  const rings = outerRings(area);
  if (rings.length === 0) return false;
  return positionsOf(shape).some((position) => rings.some((ring) => pointInRing(position, ring)));
}
