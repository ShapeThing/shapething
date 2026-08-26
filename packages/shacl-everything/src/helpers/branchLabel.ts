import type { Literal, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { localName } from "@/helpers/localName.ts";
import { sh } from "@/helpers/namespaces.ts";
import { getLabelPreference } from "@/resolution/globalConfiguration.ts";
import language, { configuredLanguages } from "@/resolution/language.ts";
import type { BCP47 } from "@/types/BCP47.ts";

// Branches (sh:or/sh:xone list members, at either the property or node level) are constraint-only
// shape nodes, not PropertyUIElements, so their label predicate value(s) are read straight off
// shapesGraph rather than through PropertyUIElement.get()/propertyLabel() (which would resolve the
// outer property's own label instead, once merged in via withBranch()).
export function branchLabel(branchShape: Term, shapesGraph: RdfStore, languages: BCP47[]): string {
  // Chrome (a label), not content - deliberately excludes sh:languageIn, see configuredLanguages.
  const effLanguages = configuredLanguages(shapesGraph, languages);

  // Mirrors propertyLabel's step 1 (8.2.2): shui:labelPreference is applied uniformly here too, for
  // consistency with the rest of label resolution, defaulting to sh:name when unconfigured - the
  // same "direct predicate only" constraint as propertyLabel's own step 1 (shape metadata can't be
  // read through a complex path).
  const configured = getLabelPreference(shapesGraph).flatMap((path) =>
    path.type === "predicate" ? [path.predicate] : [],
  );
  const predicates = configured.length > 0 ? configured : [sh("name")];

  for (const predicate of predicates) {
    const values = shapesGraph
      .getQuads(branchShape, predicate)
      .map((quad) => quad.object as Literal);
    const best = language(values, effLanguages);
    if (best) return best.value;
  }

  return (
    localName(shapesGraph.getQuads(branchShape, sh("datatype"))[0]?.object) ??
    localName(shapesGraph.getQuads(branchShape, sh("class"))[0]?.object) ??
    localName(shapesGraph.getQuads(branchShape, sh("node"))[0]?.object) ??
    branchShape.value
  );
}
