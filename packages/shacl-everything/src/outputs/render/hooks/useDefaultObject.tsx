import type { Term } from "@rdfjs/types";
import { useQuery } from "@tanstack/react-query";
import { logicalBranches, withBranch } from "@/structure/logicalBranches.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { noRefetch } from "@/helpers/noRefetch.ts";

/**
 * The term a fresh value for `property` should start as (see PropertyUIElement.getDefaultObject),
 * used to seed the first input for a property that has no values yet. Pass `enabled: false` to
 * skip resolving it - e.g. when `property` already has values and there's nothing to seed.
 *
 * A property constrained by sh:or/sh:xone has no value yet to detect a branch from, so the first
 * declared branch is used to seed it - otherwise this would fall back to a datatype-less generic
 * default, blind to any of the branches' own constraints (see structure/logicalBranches.ts).
 */
export function useDefaultObject(property: PropertyUIElement, enabled: boolean): Term | undefined {
  const { contentLanguage } = useEnvironment();

  const { data } = useQuery({
    queryKey: [
      "default-object",
      property.propertyShapes.map((shape) => shape.value),
      contentLanguage,
      enabled,
    ],
    ...noRefetch,
    // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
    // so "nothing to seed" is represented as `null` instead.
    queryFn: async () => {
      if (!enabled) return null;
      const branches = logicalBranches(property);
      const source = branches.length > 0 ? withBranch(property, branches[0].shape) : property;
      return (await source.getDefaultObject(contentLanguage)) ?? null;
    },
  });

  return data ?? undefined;
}
