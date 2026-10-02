import type { RdfStore } from "rdf-stores";
import { prefixes } from "@/helpers/namespaces.ts";

export type SpecId = "shacl-core-1" | "shacl-core-1-2" | "shacl-ui-1-2" | "dash" | "shapething";

export type SpecUsage = {
  spec: SpecId;
  label: string;
  /** Number of predicate/object term occurrences attributed to this spec. */
  count: number;
  /** 0-100, of the total recognized (sh:/shui:/dash:/st:) term occurrences in the graph. */
  percentage: number;
};

export const SPEC_LABELS: Record<SpecId, string> = {
  "shacl-core-1": "SHACL 1 Core",
  "shacl-core-1-2": "SHACL Core 1.2",
  "shacl-ui-1-2": "SHACL UI 1.2",
  dash: "DASH",
  shapething: "ShapeThing",
};

// SHACL 1.2 reuses the original http://www.w3.org/ns/shacl# namespace wholesale rather than
// minting a new one, so a term's own IRI can't tell "1.0 Core" and "1.2 Core" apart - only this
// curated list can. Local names below are exactly the new terms enumerated by the spec's own
// Appendix G, "Changes between the original SHACL Core and SHACL 1.2 Core":
// https://www.w3.org/TR/shacl12-core/#changes-12 (fetched 2026-09-11). Anything sh:-namespaced
// that ISN'T in this set - including sh:select/sh:expression (SHACL Advanced Features/SPARQL, a
// sibling spec that predates 1.2 and was never part of Core) - is counted as SHACL 1 Core.
const SHACL_1_2_LOCAL_NAMES = new Set<string>([
  "values", // node-expressions extension point
  "singleLine",
  "someValue",
  "ShapeClass",
  "ByTypes", // new sh:closed value, for per-type closing
  "ReifierShape",
  "reifierShape",
  "codeIdentifier",
  "targetWhere",
  "shape", // sh:shape, explicit shape targets
  "unit",
  "agentInstruction",
  "intent",
  "rootClass",
  "subsetOf",
  "DataGraph",
  "ShapesGraph",
  "uniqueValuesFor",
  "memberShape",
  "minListLength",
  "maxListLength",
  "uniqueMembers",
  "conformanceDisallows",
]);

function classifyIri(iri: string): SpecId | undefined {
  if (iri.startsWith(prefixes.shui)) return "shacl-ui-1-2";
  if (iri.startsWith(prefixes.dash)) return "dash";
  if (iri.startsWith(prefixes.st)) return "shapething";
  if (iri.startsWith(prefixes.sh)) {
    const localName = iri.slice(prefixes.sh.length);
    return SHACL_1_2_LOCAL_NAMES.has(localName) ? "shacl-core-1-2" : "shacl-core-1";
  }
  return undefined;
}

/**
 * Tallies how much of `shapesGraph`'s vocabulary usage belongs to each spec this library
 * implements, as a percentage breakdown. Counts every triple's predicate plus every NamedNode
 * object (so both `sh:minCount 1` and `a sh:NodeShape`/`sh:nodeKind sh:IRI`-style enum values
 * count) - subjects are deliberately not counted, since a shape's own IRI is almost always in the
 * author's namespace, not a spec's. Triples with no recognized (sh:/shui:/dash:/st:) term are
 * simply excluded from both the numerator and denominator - this reports "of the spec vocabulary
 * actually used, how is it distributed", not "how much of the graph is spec vocabulary".
 */
export function analyzeSpecUsage(shapesGraph: RdfStore): SpecUsage[] {
  const counts = new Map<SpecId, number>();
  const tally = (iri: string) => {
    const spec = classifyIri(iri);
    if (spec) counts.set(spec, (counts.get(spec) ?? 0) + 1);
  };

  for (const quad of shapesGraph.getQuads()) {
    if (quad.predicate.termType === "NamedNode") tally(quad.predicate.value);
    if (quad.object.termType === "NamedNode") tally(quad.object.value);
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

  return (Object.keys(SPEC_LABELS) as SpecId[])
    .map((spec): SpecUsage => {
      const count = counts.get(spec) ?? 0;
      return {
        spec,
        label: SPEC_LABELS[spec],
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
    })
    .filter((usage) => usage.count > 0)
    .sort((a, b) => b.count - a.count);
}
