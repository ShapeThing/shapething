// The widget SDK: everything a custom editor/viewer/facet/group widget needs to plug into
// Environment.widgets and behave like a bundled one - the contract types, the bundled registry to
// extend (`{ ...defaultWidgets, editors: { ...defaultWidgets.editors, MyEditor: entry } }`), the
// structure element a widget is handed (`shape`), and the hooks the bundled widgets themselves are
// built on. Re-exported from the package entry point (src/index.ts).

// Contract types.
export type {
  CreateTermContext,
  FacetWidgetComponent,
  FacetWidgetProps,
  FacetWidgetRegistryEntry,
  GroupWidgetComponent,
  GroupWidgetProps,
  GroupWidgetRegistryEntry,
  WidgetComponent,
  WidgetMeta,
  WidgetProps,
  WidgetRegistryEntry,
  Widgets,
} from "@/widgets/types.ts";

// The bundled registry, and lookups over any registry.
export { defaultWidgets, getScoringGraph } from "@/widgets/registry.ts";
export {
  getGroupWidget,
  getWidgetComponent,
  getWidgetMeta,
  NO_WIDGETS,
  widgetModeForPredicate,
  type WidgetMode,
} from "@/widgets/lookup.ts";
export { defaultTermFromShape } from "@/widgets/defaultTerm.ts";

// The structure elements a widget receives/builds.
export { PropertyUIElement, type PropertyUIElementOptions } from "@/structure/PropertyUIElement.ts";
export { NodeUIElement, type NodeUIElementOptions } from "@/structure/NodeUIElement.ts";
export type { GroupUIElement } from "@/structure/GroupUIElement.ts";
export type { ChoiceElement } from "@/structure/ChoiceElement.ts";

// Hooks.
export { useEnvironment } from "@/outputs/render/hooks/useEnvironment.tsx";
export { useContentLanguage } from "@/outputs/render/hooks/useContentLanguage.tsx";
export { useInterfaceLanguage } from "@/outputs/render/hooks/useInterfaceLanguage.tsx";
export { useDeferredInput } from "@/outputs/render/hooks/useDeferredInput.ts";
export { useAutoFocusRef } from "@/outputs/render/hooks/useAutoFocusRef.ts";
export { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
export { useReactiveRead } from "@/outputs/render/hooks/useReactiveRead.tsx";
export {
  useFacetColorBuckets,
  useFacetValueBounds,
  useFacetValueCounts,
  useFacetValues,
} from "@/outputs/render/modes/facet/facetData.tsx";
export {
  nestedNodeElement,
  type NestedNodeOptions,
  useNestedNode,
} from "@/outputs/render/hooks/useNestedNode.ts";
export {
  type CreateInPlace,
  type CreateInPlaceDraft,
  useCreateInPlace,
} from "@/outputs/render/hooks/useCreateInPlace.ts";

// Rendering a nested form (e.g. from useNestedNode/useCreateInPlace) inside a widget.
export { default as EditNodeUIElementChildren } from "@/outputs/render/modes/edit/NodeUIElementChildren.tsx";
export { default as ViewNodeUIElementChildren } from "@/outputs/render/modes/view/NodeUIElementChildren.tsx";
