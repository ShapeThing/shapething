import type { Term } from "@rdfjs/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { termKey } from "@/helpers/termKey.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { getWidgetComponent, getWidgetMeta } from "@/widgets/registry.ts";
import type { FacetWidgetComponent, WidgetComponent, WidgetMeta } from "@/widgets/types.ts";
import { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
import { noRefetch } from "@/helpers/noRefetch.ts";

/**
 * Resolves the highest-scoring widget component for a property, per the environment's
 * scoresGraph and mode (edit/view/facet all score the same way - see scoring/score.ts).
 *
 * `valueNode` additionally scores the property's actual value against each rule's
 * shui:dataGraphShape (e.g. picking a different widget for a URL than for plain text sharing the
 * same property) - omit it to score on the property shape(s) alone. Facet mode never has a single
 * value to pass here (see structure/facetValues.ts) - it always scores on the property shape(s)
 * alone.
 *
 * `T` lets a facet-mode caller narrow `Widget`'s type to `FacetWidgetComponent` instead of the
 * default `WidgetComponent` (edit/view's shape), since which one `mode` actually resolves to isn't
 * something registry.ts's return type alone can express - see useFacetWidget's own wrapper below.
 */
export function useWidget<T extends WidgetComponent | FacetWidgetComponent = WidgetComponent>(
  widgetPredicate: Term,
  property: PropertyUIElement,
  valueNode?: Term,
):
  | {
      Widget: T;
      iri: Term;
      meta: WidgetMeta | undefined;
      // True while `Widget` is still the previous query key's result (via keepPreviousData),
      // shown to avoid unmounting the widget on every keystroke - callers that need to react to
      // the resolved widget actually changing (e.g. an sh:or branch switch) should wait for this
      // to go false rather than trusting `Widget` the instant it changes.
      isPlaceholderData: boolean;
    }
  | undefined {
  const { mode } = useEnvironment();

  const { data: widget, isPlaceholderData } = useQuery({
    queryKey: [
      "widget",
      mode,
      property.propertyShapes.map((shape) => shape.value),
      valueNode ? termKey(valueNode) : "no-object",
    ],
    // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
    // so the no-match case is represented as `null` instead.
    queryFn: async () => (await property.widget({ widgetPredicate, valueNode })) ?? null,
    placeholderData: keepPreviousData,
    ...noRefetch,
  });

  if (!widget || widget.termType !== "NamedNode") return undefined;
  return {
    Widget: getWidgetComponent(mode, widget, property.widgetRegistry) as T,
    meta: getWidgetMeta(widget, property.widgetRegistry),
    iri: widget,
    isPlaceholderData,
  };
}
