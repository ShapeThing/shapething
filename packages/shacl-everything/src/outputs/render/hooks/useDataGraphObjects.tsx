import { useRef, useSyncExternalStore } from "react";
import type { Term } from "@rdfjs/types";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { getReactivity, type Pattern } from "@/helpers/reactiveRdfStore.ts";

type Cache = { key: string; objects: Term[]; patterns: Pattern[] };

function cacheKey(property: PropertyUIElement): string {
  return `${property.propertyShapes.map((shape) => shape.value).join("|")}@${property.focusNode.value}`;
}

/**
 * This property's current values (see PropertyUIElement.getObjects), kept live: a write elsewhere
 * in the app only re-renders this component when it actually touches a pattern this property's
 * own path read - see helpers/reactiveRdfStore.ts. Falls back to a single untracked read, with no
 * live updates, when property.dataGraph wasn't wrapped via makeReactive() (e.g. a PropertyUIElement
 * built directly against a plain RdfStore in a test).
 */
export function useDataGraphObjects(property: PropertyUIElement): Term[] {
  const cache = useRef<Cache | null>(null);
  const reactivity = getReactivity(property.dataGraph);

  const read = (): Cache => {
    const key = cacheKey(property);
    if (!reactivity) return { key, objects: property.getObjects(), patterns: [] };
    const { result, patterns } = reactivity.track(() => property.getObjects());
    return { key, objects: result, patterns };
  };

  const getSnapshot = () => {
    if (!cache.current || cache.current.key !== cacheKey(property)) cache.current = read();
    return cache.current.objects;
  };

  const subscribe = (onStoreChange: () => void) => {
    if (!reactivity) return () => {};
    if (!cache.current || cache.current.key !== cacheKey(property)) cache.current = read();
    return reactivity.subscribe(cache.current.patterns, () => {
      cache.current = null;
      onStoreChange();
    });
  };

  return useSyncExternalStore(subscribe, getSnapshot);
}
