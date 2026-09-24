import type { Term } from "@rdfjs/types";
import {
  booleanContains,
  booleanCrosses,
  booleanDisjoint,
  booleanEqual,
  booleanIntersects,
  booleanOverlap,
  booleanTouches,
  booleanWithin,
} from "@turf/turf";
import type { Feature, Geometry } from "geojson";
import { factory } from "@/helpers/factory.ts";
import { literalToGeometry } from "@/helpers/geometryLiteral.ts";
import { geof, xsd } from "@/helpers/namespaces.ts";

type SpatialRelation = (a: Feature | Geometry, b: Feature | Geometry) => boolean;

// The GeoSPARQL "Simple Features" relation family (geof:sfEquals/sfDisjoint/sfIntersects/sfTouches/
// sfCrosses/sfWithin/sfContains/sfOverlaps) - every one of them backed by @turf/turf's own boolean-*
// predicate, which implements the real OGC semantics (holes, edge-touching, line/point cases).
// structure/facetValues.ts's countFacetInstancesWithinArea calls booleanWithin directly (not via
// this Comunica registration) for the same reason - one real predicate, two call sites.
const SIMPLE_FEATURES_RELATIONS: Record<string, SpatialRelation> = {
  sfEquals: booleanEqual,
  sfDisjoint: booleanDisjoint,
  sfIntersects: booleanIntersects,
  sfTouches: booleanTouches,
  sfCrosses: booleanCrosses,
  sfWithin: booleanWithin,
  sfContains: booleanContains,
  sfOverlaps: booleanOverlap,
};

// Comunica's own `extensionFunctions` context-entry shape (see outputs/render/hooks/query.ts) -
// declared locally rather than imported, since Comunica only types it inline on its query context
// (Record<string, (args: RDF.Term[]) => Promise<RDF.Term>>), not as an exported type of its own.
export type ExtensionFunction = (args: Term[]) => Promise<Term>;

/**
 * geof: Simple Features spatial relation functions, registered as Comunica extension functions (see
 * outputs/render/hooks/query.ts's runQuery) so any SPARQL FILTER/BIND this package runs - local
 * dataGraph or federated SERVICE - can test a real OGC spatial relation between two GeoSPARQL
 * geometry values (any term literalToGeometry recognizes: a wktLiteral, or GeoJSON text) instead of
 * the app hand-rolling geometry math itself. A non-boolean or otherwise malformed argument (missing,
 * not a literal, unparsable as a geometry) makes the relation false rather than throwing - a shape
 * author's FILTER simply excludes that binding, the same "quietly false" behavior a real geof:
 * function has for a genuine ogc:geomLiteral type mismatch.
 */
export const geosparqlExtensionFunctions: Record<string, ExtensionFunction> = Object.fromEntries(
  Object.entries(SIMPLE_FEATURES_RELATIONS).map(([localName, relation]) => [
    geof(localName).value,
    async (args: Term[]): Promise<Term> => {
      const a = args[0] && literalToGeometry(args[0]);
      const b = args[1] && literalToGeometry(args[1]);
      const result = a !== undefined && b !== undefined && relation(a, b);
      return factory.literal(String(result), xsd("boolean"));
    },
  ]),
);
