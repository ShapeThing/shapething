import type { Term } from "@rdfjs/types";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";

function cacheKey(property: PropertyUIElement): string {
  return `${property.propertyShapes.map((shape) => shape.value).join("|")}@${property.focusNode.value}`;
}

/**
 * This property's current values (see PropertyUIElement.getObjects), kept live - see
 * useReactiveRead()/helpers/reactiveRdfStore.ts.
 */
export function useDataGraphObjects(property: PropertyUIElement): Term[] {
  return useReactiveRead(property.dataGraph, cacheKey(property), () => property.getObjects());
}
