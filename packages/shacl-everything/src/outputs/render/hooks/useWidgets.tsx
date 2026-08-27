import type { NamedNode, Term } from "@rdfjs/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { termKey } from "@/helpers/termKey.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { getWidgetComponent, getWidgetMeta } from "@/widgets/registry.ts";
import type { WidgetComponent, WidgetMeta } from "@/widgets/types.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { noRefetch } from "@/helpers/noRefetch.ts";

/**
 * Resolves the highest-scoring widget component for a property, per the environment's
 * scoresGraph and mode. Facet mode has no widget scoring rules yet, so it never resolves one.
 *
 * `valueNode` additionally scores the property's actual value against each rule's
 * shui:dataGraphShape (e.g. picking a different widget for a URL than for plain text sharing the
 * same property) - omit it to score on the property shape(s) alone.
 */
export function useWidgets(
  widgetPredicate: Term,
  property: PropertyUIElement,
  valueNode?: Term,
): {
  Widget: WidgetComponent;
  iri: Term;
  meta: WidgetMeta | undefined;
  score: number;
}[] {
  const { mode } = useEnvironment();

  const { data: widgets } = useQuery({
    queryKey: [
      "widgets",
      mode,
      property.propertyShapes.map((shape) => shape.value),
      valueNode ? termKey(valueNode) : "no-object",
    ],
    // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
    // so the no-match case is represented as `null` instead.
    queryFn: async () => (await property.widgets({ widgetPredicate, valueNode })) ?? null,
    placeholderData: keepPreviousData,
    ...noRefetch,
  });

  if (!widgets || mode === "facet") return [];

  const seen = new Set<string>();
  return (
    widgets
      .filter((widgetResult) => widgetResult.widget.termType === "NamedNode")
      // A widget can have several WidgetScore rules that all match the same property at once (e.g.
      // TextFieldEditor scoring both on shui:isString and shui:hasDatatypeStringConstraint), so the
      // same widget IRI can appear more than once here - keep only its highest-scoring entry, which
      // is the first one since score() already yields in descending-score order.
      .filter(({ widget }) => (seen.has(widget.value) ? false : (seen.add(widget.value), true)))
      .map(({ widget, score }) => ({
        Widget: getWidgetComponent(mode, widget as NamedNode, property.widgetRegistry)!,
        meta: getWidgetMeta(widget as NamedNode, property.widgetRegistry),
        iri: widget,
        score,
      }))
  );
}
