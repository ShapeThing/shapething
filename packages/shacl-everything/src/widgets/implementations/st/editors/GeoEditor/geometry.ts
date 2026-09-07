import type { Literal, Term } from "@rdfjs/types";
import type { Feature, Geometry } from "geojson";
import { parse as parseWkt, stringify as stringifyWkt } from "wkt";
import { factory } from "@/helpers/factory.ts";
import { geosparql } from "@/helpers/namespaces.ts";

// Mirrors MapViewer/geometry.ts's own GEOJSON_TYPES - kept as a separate, smaller copy here
// (Point/LineString/Polygon only) since this editor only ever draws/writes what its own toolbar
// can produce (see widget.tsx's drawModes), unlike the viewer, which reads whatever a shape author
// happened to put in the data.
const GEOJSON_TYPES = new Set(["Point", "LineString", "Polygon", "Feature"]);

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
// custom datatype - one whose lexical value happens to parse as GeoJSON text. Only the direct-
// literal representation this editor itself writes (see geometryToLiteral below) - unlike
// MapViewer/geometry.ts's own literalToGeometry, there's no st:GeoRole one-hop fallback here: this
// editor only ever edits the property's own value, never a nested node's sub-property.
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

/**
 * Resolves one of this property's existing values into a GeoJSON Feature carrying `id` (a
 * termKey-based stable key, purely as a hint for the editor's own internal feature store - nothing
 * in widget.tsx relies on it coming back unchanged; see syncFromEditor's own comment for why not).
 * Undefined for a value this editor doesn't recognize as geometry at all (see literalToGeometry).
 */
export function termToFeature(term: Term, id: string): Feature | undefined {
  const geometry = literalToGeometry(term);
  if (!geometry) return undefined;
  return geometry.type === "Feature"
    ? { ...geometry, id, properties: geometry.properties ?? {} }
    : { type: "Feature", id, geometry, properties: {} };
}

/**
 * The write-side counterpart to termToFeature() - always writes a GeoSPARQL WKT literal (the same
 * representation MapViewer scores highest on, see its own score.ttl), regardless of which
 * representation an existing value happened to use. Undefined for a geometry type wkt's stringify()
 * doesn't support (GeometryCollection is the only one among this editor's draw modes' possible
 * outputs that would hit this - none of marker/line/polygon/rectangle/circle ever produce one).
 */
export function geometryToLiteral(feature: Feature): Literal | undefined {
  try {
    return factory.literal(stringifyWkt(feature), geosparql("wktLiteral"));
  } catch {
    return undefined;
  }
}

/**
 * The canonical WKT text an existing value's geometry round-trips to (parse, then re-stringify) -
 * undefined for a value this editor doesn't recognize as geometry (see literalToGeometry). This is
 * what syncFromEditor compares an existing term against, rather than the term's own raw lexical
 * text: wkt's stringify() doesn't reproduce a literal's original formatting byte-for-byte (e.g.
 * trailing zeros), so comparing raw text against a freshly-stringified map feature would treat
 * every untouched existing value as "changed" the moment any other feature on the same map is
 * edited. Passing both sides of a comparison through this same round-trip cancels that out.
 */
export function canonicalWktValue(term: Term): string | undefined {
  const geometry = literalToGeometry(term);
  if (!geometry) return undefined;
  try {
    return stringifyWkt(geometry);
  } catch {
    return undefined;
  }
}
