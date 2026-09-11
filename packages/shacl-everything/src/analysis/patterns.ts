import type { Quad_Subject } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { findDynamicInSubjects } from "@/structure/dynamicIn.ts";
import { sh, shui, st } from "@/helpers/namespaces.ts";

export type PatternId =
  | "candidate-values-via-dynamic-shacl"
  | "composed-label-via-alternative-path";

export type DetectedPattern = {
  pattern: PatternId;
  label: string;
  description: string;
  /** IRIs/blank node ids of the shapes graph subjects where this pattern was found. */
  subjects: string[];
  count: number;
};

export const PATTERN_LABELS: Record<PatternId, string> = {
  "candidate-values-via-dynamic-shacl": "Candidate values via Dynamic SHACL",
  "composed-label-via-alternative-path": "Composed label via alternative path",
};

/**
 * Every property shape whose sh:node has a shui:LabelRole property opted into st:mergeAlternatives
 * - the idiom for a label composed from several sh:alternativePath branches (e.g. quantity, unit,
 * name for one recipe ingredient) instead of plain SHACL alternation (first branch with a value
 * wins). See resolution/label.ts's resolveLabelRolePathParts, which is what actually renders these
 * branches into one combined label string.
 */
function findComposedLabelViaAlternativePathSubjects(shapesGraph: RdfStore): Quad_Subject[] {
  const subjects: Quad_Subject[] = [];

  for (const { subject, object: nodeShape } of shapesGraph.getQuads(null, sh("node"))) {
    const hasMergedLabelRole = shapesGraph
      .getQuads(nodeShape, sh("property"))
      .filter(
        ({ object: property }) =>
          shapesGraph.getQuads(property, shui("propertyRole"), shui("LabelRole")).length > 0,
      )
      .some(({ object: property }) =>
        shapesGraph
          .getQuads(property, st("mergeAlternatives"))
          .some((quad) => quad.object.value === "true"),
      );

    if (hasMergedLabelRole) subjects.push(subject);
  }

  return subjects;
}

/**
 * Detects notable non-spec idioms this library recognizes in a shapes graph, beyond plain spec
 * vocabulary usage:
 * - "Candidate values via Dynamic SHACL" - a `sh:in` whose value is a nested `sh:select` query
 *   rather than a fixed rdf:List, i.e. candidate values resolved live via SPARQL instead of an
 *   author-supplied enumeration (see EnumSelectEditor/AutoCompleteEditor's federated-search
 *   stories, and shapesGraphWithoutDynamicIn.ts/selectQueryFor.ts, which this shares its
 *   definition of "dynamic" with via findDynamicInSubjects()).
 * - "Composed label via alternative path" - an sh:node's shui:LabelRole property opted into
 *   st:mergeAlternatives, combining its sh:alternativePath's branches into one composed label (see
 *   findComposedLabelViaAlternativePathSubjects above).
 */
export function detectPatterns(shapesGraph: RdfStore): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const dynamicInSubjects = findDynamicInSubjects(shapesGraph);
  if (dynamicInSubjects.length > 0) {
    patterns.push({
      pattern: "candidate-values-via-dynamic-shacl",
      label: PATTERN_LABELS["candidate-values-via-dynamic-shacl"],
      description:
        "sh:in whose value is a nested sh:select query instead of a fixed list of values.",
      subjects: dynamicInSubjects.map((subject) => subject.value),
      count: dynamicInSubjects.length,
    });
  }

  const composedLabelSubjects = findComposedLabelViaAlternativePathSubjects(shapesGraph);
  if (composedLabelSubjects.length > 0) {
    patterns.push({
      pattern: "composed-label-via-alternative-path",
      label: PATTERN_LABELS["composed-label-via-alternative-path"],
      description:
        "sh:node's shui:LabelRole property is opted into st:mergeAlternatives, combining several sh:alternativePath fields (e.g. quantity, unit, name) into one composed label.",
      subjects: composedLabelSubjects.map((subject) => subject.value),
      count: composedLabelSubjects.length,
    });
  }

  return patterns;
}
