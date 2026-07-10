import type { Term } from "@rdfjs/types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { termKey } from "@/helpers/termKey.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { getWidgetComponent } from "@/widgets/registry.ts";
import type { ObjectWidgetComponent } from "@/widgets/types.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";

/**
 * Resolves the highest-scoring widget component for a property, per the environment's
 * scoresGraph and mode. Facet mode has no widget scoring rules yet, so it never resolves one.
 *
 * `valueNode` additionally scores the property's actual value against each rule's
 * shui:dataGraphShape (e.g. picking a different widget for a URL than for plain text sharing the
 * same property) - omit it to score on the property shape(s) alone.
 */
export function useWidget(
  property: PropertyUIElement,
  valueNode?: Term,
): ObjectWidgetComponent | undefined {
  const { mode } = useEnvironment();

  const { data: widget } = useSuspenseQuery({
    queryKey: [
      "widget",
      mode,
      property.propertyShapes.map((shape) => shape.value),
      valueNode && termKey(valueNode),
    ],
    // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
    // so the no-match case is represented as `null` instead.
    queryFn: async () => (await property.widget(valueNode)) ?? null,
  });

  if (!widget || widget.termType !== "NamedNode" || mode === "facet") return undefined;
  return getWidgetComponent(mode, widget);
}
