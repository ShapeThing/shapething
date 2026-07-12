import type { Term } from "@rdfjs/types";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { noRefetch } from "@/helpers/noRefetch.ts";

/**
 * The term a fresh value for `property` should start as (see PropertyUIElement.getDefaultObject),
 * used to seed the first input for a property that has no values yet. Pass `enabled: false` to
 * skip resolving it - e.g. when `property` already has values and there's nothing to seed.
 */
export function useDefaultObject(property: PropertyUIElement, enabled: boolean): Term | undefined {
  const { contentLanguage } = useEnvironment();

  const { data } = useSuspenseQuery({
    queryKey: [
      "default-object",
      property.propertyShapes.map((shape) => shape.value),
      contentLanguage,
      enabled,
    ],
    ...noRefetch,
    // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
    // so "nothing to seed" is represented as `null` instead.
    queryFn: async () =>
      enabled ? ((await property.getDefaultObject(contentLanguage)) ?? null) : null,
  });

  return data ?? undefined;
}
