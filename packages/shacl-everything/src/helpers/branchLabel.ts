import type { Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { localName } from "@/helpers/localName.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { BCP47 } from "@/types/BCP47.ts";

// Branches (sh:or/sh:xone list members, at either the property or node level) are constraint-only
// shape nodes, not PropertyUIElements, so their sh:name is read straight off shapesGraph rather
// than through PropertyUIElement.getOne() (which would resolve the outer property's own sh:name
// instead, once merged in via withBranch()).
export function branchLabel(branchShape: Term, shapesGraph: RdfStore, languages: BCP47[]): string {
  const names = shapesGraph.getQuads(branchShape, sh("name")).map((quad) => quad.object);
  const best = names.length > 0 ? bestByLanguage(names, languages) : undefined;
  if (best) return best.value;

  return (
    localName(shapesGraph.getQuads(branchShape, sh("datatype"))[0]?.object) ??
    localName(shapesGraph.getQuads(branchShape, sh("class"))[0]?.object) ??
    localName(shapesGraph.getQuads(branchShape, sh("node"))[0]?.object) ??
    branchShape.value
  );
}
