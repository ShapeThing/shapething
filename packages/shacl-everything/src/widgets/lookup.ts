import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf, sh, shui, st } from "@/helpers/namespaces.ts";
import type {
  FacetWidgetComponent,
  GroupWidgetRegistryEntry,
  WidgetComponent,
  WidgetMeta,
  WidgetRegistryEntry,
  Widgets,
} from "@/widgets/types.ts";

// Pure lookups over an explicitly-passed `Widgets` registry - deliberately free of any widget
// implementation (and of React), unlike widgets/registry.ts, which glob-imports every bundled
// widget to build `defaultWidgets`. The structure/ model layer and widgets/defaultTerm.ts import
// from here, so resolving a meta.ts/group entry never drags the whole widget bundle in; registry.ts
// re-exports these with a `defaultWidgets` fallback for callers that want the bundled set.

export type WidgetMode = "edit" | "view" | "facet";

export function categoryFor(mode: WidgetMode, widgets: Widgets) {
  if (mode === "edit") return widgets.editors;
  if (mode === "view") return widgets.viewers;
  if (mode === "facet") return widgets.facets;
  throw new Error(`Unknown widget mode: ${mode}`);
}

// The inverse of categoryFor: which WidgetMode's pool a given shui:editor/shui:viewer/st:facet
// widgetPredicate resolves widgets from. Lets a caller (useWidget, score()'s category filter)
// derive the right mode straight from the predicate it's already scoring/resolving against,
// instead of trusting the ambient Environment.mode - the two usually coincide (edit mode always
// scores shui:editor, view always shui:viewer), but edit mode's read-only rendering deliberately
// resolves a shui:viewer widget while Environment.mode stays "edit", so they can't be conflated.
export function widgetModeForPredicate(
  widgetPredicate: Term,
): WidgetMode | undefined {
  if (widgetPredicate.equals(shui("editor"))) return "edit";
  if (widgetPredicate.equals(shui("viewer"))) return "view";
  if (widgetPredicate.equals(st("facet"))) return "facet";
  return undefined;
}

function findWidget<T extends { widget: NamedNode }>(
  entries: Record<string, T>,
  widget: NamedNode,
): T | undefined {
  return Object.values(entries).find((entry) => entry.widget.equals(widget));
}

/**
 * Resolves a widget's own type IRI (e.g. shui:TextFieldEditor or st:CategoryFacet, as picked by
 * PropertyUIElement.widget()) to the React component implementing it, matched against the active
 * `widgets`' own editors/viewers/facets entries (by `mode`) by IRI equality (not by folder path -
 * `widgets` need not be the bundled
 * `defaultWidgets` at all). The return type follows `mode`: callers that know their mode statically
 * (e.g. useWidget's own generic parameter) can narrow past the union themselves.
 */
export function getWidgetComponent(
  mode: WidgetMode,
  widget: NamedNode,
  widgets: Widgets,
): WidgetComponent | FacetWidgetComponent | undefined {
  // categoryFor's return type is a plain union across editors/viewers/facets - the caller-supplied
  // `mode` is what actually picks the right category (and, with it, the right Component shape) at
  // runtime, same "narrow past the union yourself" story as this function's own return type (see
  // its doc comment above).
  return findWidget(
    categoryFor(mode, widgets) as Record<string, WidgetRegistryEntry>,
    widget,
  )
    ?.Component;
}

/**
 * Resolves a widget IRI to its meta.ts (see WidgetMeta) - `undefined` both when the widget has no
 * meta.ts and when it has one that declares no overrides. `createTerm` is only ever populated for
 * an editor (see WidgetMeta's own doc), but `singleUnifiedWidget` applies just as well to a viewer
 * (e.g. ValueTableViewer, which renders every value itself rather than once per value) - so both
 * categories are searched, by IRI equality, without needing to know which one a caller's widget
 * came from.
 */
export function getWidgetMeta(
  widget: NamedNode,
  widgets: Widgets,
): WidgetMeta | undefined {
  return findWidget(widgets.editors, widget)?.meta ??
    findWidget(widgets.viewers, widget)?.meta;
}

/**
 * Resolves the registered group widget for `node`'s own rdf:type - simple, direct type matching,
 * no scoring system. sh:PropertyGroup is the mandatory base type every group carries (see
 * structure/groupChildren.ts's validation step) and is never itself a deliberate widget choice, so
 * a more specific registered type present on the same node (e.g. st:CollapsiblePropertyGroup, on
 * `a sh:PropertyGroup, st:CollapsiblePropertyGroup`) always wins over it.
 */
export function getGroupWidget(
  node: Term,
  shapesGraph: RdfStore,
  widgets: Widgets,
): GroupWidgetRegistryEntry | undefined {
  const types = shapesGraph.getQuads(node, rdf("type")).map((quad) =>
    quad.object
  );
  const matches = Object.values(widgets.groups).filter((entry) =>
    types.some((type) => type.equals(entry.widget))
  );
  return matches.find((entry) => !entry.widget.equals(sh("PropertyGroup"))) ??
    matches[0];
}

/**
 * An explicitly empty registry, for structure-only consumers that build NodeUIElements/
 * PropertyUIElements purely to read shape metadata and values (the rdf-to-js/js-to-rdf/generate/
 * shacl-to-type tools, validateDynamicInProperties) and never resolve a widget, meta.ts or group
 * widget from them - so they stay free of the bundled widget set (and React) altogether.
 */
export const NO_WIDGETS: Widgets = { editors: {}, viewers: {}, groups: {}, facets: {} };
