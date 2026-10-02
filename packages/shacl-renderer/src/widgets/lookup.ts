import type { NamedNode, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { sh, shui, st } from "@/helpers/namespaces.ts";
import { groupTypes } from "@/structure/groupTypes.ts";
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
// Environment.mode's own widget pool: report mode renders through the view-mode tree (see
// outputs/render/modes/report/), so it resolves viewers.
export function widgetModeForEnvironment(mode: WidgetMode | "report"): WidgetMode {
  return mode === "report" ? "view" : mode;
}

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
 * Resolves the registered group widget for `node`'s rdf:type - type matching, no scoring system.
 * Its types are tried nearest first, subclasses included (see structure/groupTypes.ts), so a node
 * typed with a shape author's own `ex:MyGroup rdfs:subClassOf st:DrawerPropertyGroup` gets the
 * drawer. sh:PropertyGroup is the root every group type specializes and is never itself a
 * deliberate widget choice, so any more specific registered type (e.g. st:CollapsiblePropertyGroup,
 * on `a st:CollapsiblePropertyGroup` or `a sh:PropertyGroup, st:CollapsiblePropertyGroup`) always
 * wins over it.
 */
export function getGroupWidget(
  node: Term,
  shapesGraph: RdfStore,
  widgets: Widgets,
): GroupWidgetRegistryEntry | undefined {
  const entries = Object.values(widgets.groups);
  const entryFor = (type: Term) => entries.find((entry) => entry.widget.equals(type));
  const types = groupTypes(node, [shapesGraph]);
  for (const type of types) {
    if (type.equals(sh("PropertyGroup"))) continue;
    const entry = entryFor(type);
    if (entry) return entry;
  }
  return types.some((type) => type.equals(sh("PropertyGroup")))
    ? entryFor(sh("PropertyGroup"))
    : undefined;
}

/**
 * An explicitly empty registry, for structure-only consumers that build NodeUIElements/
 * PropertyUIElements purely to read shape metadata and values (the rdf-to-js/js-to-rdf/generate/
 * shacl-to-type tools, validateDynamicInProperties) and never resolve a widget, meta.ts or group
 * widget from them - so they stay free of the bundled widget set (and React) altogether.
 */
export const NO_WIDGETS: Widgets = { editors: {}, viewers: {}, groups: {}, facets: {} };
