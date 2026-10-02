import type { Term } from "@rdfjs/types";
import { rdf, rdfs, st } from "@/helpers/namespaces.ts";
import type { LovTermType } from "@/helpers/lovTermSearch.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

// st:iriType - see the ShapeThing vocabulary spec - lets a shape author scope IRIEditor's LOV
// suggestions to just classes, just properties, or (whichever this returns undefined for) both -
// e.g. a property whose value is always a rdfs:Class shouldn't also offer property suggestions:
//
//   ex:ShapeExample sh:property [ sh:path ex:someClassRef ; st:iriType rdfs:Class ] .
const IRI_TYPE_TERMS: Record<string, LovTermType> = {
  [rdf("Property").value]: "property",
  [rdfs("Class").value]: "class",
};

export function iriTypesFor(shape: PropertyUIElement): LovTermType[] | undefined {
  const declared = shape.get(st("iriType"));
  if (!Array.isArray(declared) || declared.length === 0) return undefined;

  const types = (declared as Term[])
    .map((term) => IRI_TYPE_TERMS[term.value])
    .filter((type): type is LovTermType => type !== undefined);
  return types.length > 0 ? types : undefined;
}
