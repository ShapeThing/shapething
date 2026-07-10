import { useSuspenseQuery } from "@tanstack/react-query";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { getWidgetComponent } from "@/widgets/registry.ts";
import type { ObjectWidgetComponent } from "@/widgets/types.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";

/**
 * Resolves the highest-scoring widget component for a property, per the environment's
 * scoresGraph and mode. Facet mode has no widget scoring rules yet, so it never resolves one.
 */
export function useWidget(property: PropertyUIElement): ObjectWidgetComponent | undefined {
  const { mode } = useEnvironment();

  const { data: widget } = useSuspenseQuery({
    queryKey: ["widget", mode, property.propertyShapes.map((shape) => shape.value)],
    // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
    // so the no-match case is represented as `null` instead.
    queryFn: async () => (await property.widget()) ?? null,
  });

  if (!widget || widget.termType !== "NamedNode" || mode === "facet") return undefined;
  return getWidgetComponent(mode, widget);
}
