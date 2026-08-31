import type { NamedNode, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { prefixes, rdf, sh, shui, st } from "@/helpers/namespaces.ts";
import type {
  FacetWidgetComponent,
  FacetWidgetRegistryEntry,
  GroupWidgetComponent,
  GroupWidgetRegistryEntry,
  WidgetComponent,
  WidgetMeta,
  WidgetRegistryEntry,
  Widgets,
} from "@/widgets/types.ts";
import widgetScoringTtl from "@/scoring/widget-scoring.ttl?raw";

// Every widget implementation lives at implementations/<namespace>/<category>/<Name>/ - e.g.
// shui/editors/TextFieldEditor or st/groups/CollapsiblePropertyGroup. `category` is which of
// Widgets' three buckets (editors/viewers/groups) the widget registers under; `namespace` is
// which RDF vocabulary its IRI belongs to. Neither is fixed to one value up front (editors/viewers
// aren't hardcoded to shui: any more than groups are hardcoded to sh:/st:) - both are read off the
// path generically, so a new namespace or category folder under implementations/ is picked up
// without touching this file. The namespace folder name must be a prefix registered in
// helpers/namespaces.ts's `prefixes` (its own alias, e.g. "sh"/"shui"/"st") - that's the single
// source of truth for which IRI a namespace folder resolves to.
const components = import.meta.glob("/src/widgets/implementations/*/*/*/widget.tsx", {
  eager: true,
  import: "default",
}) as Record<string, WidgetComponent | GroupWidgetComponent | FacetWidgetComponent>;

const scoringGraphs = import.meta.glob("/src/widgets/implementations/*/*/*/score.ttl", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

// Only editors ever produce a fresh/empty term for a property, so meta.ts (and createTerm) is an
// editor-only concept in practice - viewers/groups have nothing to create - but is discovered the
// same generic way; a meta.ts under a viewers/groups folder would simply never be looked up.
const meta = import.meta.glob("/src/widgets/implementations/*/*/*/meta.ts", {
  eager: true,
  import: "default",
}) as Record<string, WidgetMeta>;

// e.g. "/src/widgets/implementations/shui/editors/TextFieldEditor/widget.tsx" -> "TextFieldEditor"
function folderName(path: string): string {
  return path.split("/").at(-2)!;
}

// e.g. "/src/widgets/implementations/shui/editors/TextFieldEditor/widget.tsx" -> "editors"
function categorySegment(path: string): string {
  return path.split("/").at(-3)!;
}

// e.g. "/src/widgets/implementations/sh/groups/PropertyGroup/widget.tsx" -> "sh"
function namespaceSegment(path: string): string {
  return path.split("/").at(-4)!;
}

function widgetIri(path: string): NamedNode {
  const segment = namespaceSegment(path);
  const prefix = prefixes[segment];
  if (!prefix) {
    throw new Error(
      `Unknown widget namespace "${segment}" for ${path} - add it to helpers/namespaces.ts's prefixes`,
    );
  }
  return factory.namedNode(`${prefix}${folderName(path)}`);
}

function buildEntries(category: "editors" | "viewers"): Record<string, WidgetRegistryEntry> {
  const entries: Record<string, WidgetRegistryEntry> = {};
  for (const [path, Component] of Object.entries(components)) {
    if (categorySegment(path) !== category) continue;
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: Component as WidgetComponent,
      meta: meta[path.replace(/widget\.tsx$/, "meta.ts")],
      scoringGraph: scoringGraphs[path.replace(/widget\.tsx$/, "score.ttl")],
    };
  }
  return entries;
}

// Facets have no meta.ts concept (see WidgetMeta's doc - createTerm/canAddMore/singleUnifiedWidget
// are all editor/viewer-only) - just widget + scoringGraph, same as buildEntries above minus meta.
function buildFacetEntries(): Record<string, FacetWidgetRegistryEntry> {
  const entries: Record<string, FacetWidgetRegistryEntry> = {};
  for (const [path, Component] of Object.entries(components)) {
    if (categorySegment(path) !== "facets") continue;
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: Component as FacetWidgetComponent,
      scoringGraph: scoringGraphs[path.replace(/widget\.tsx$/, "score.ttl")],
    };
  }
  return entries;
}

function buildGroupEntries(): Record<string, GroupWidgetRegistryEntry> {
  const entries: Record<string, GroupWidgetRegistryEntry> = {};
  for (const [path, Component] of Object.entries(components)) {
    if (categorySegment(path) !== "groups") continue;
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: Component as GroupWidgetComponent,
    };
  }
  return entries;
}

/**
 * Every widget bundled with this library, organized exactly like `Environment.widgets`/`Widgets`
 * itself - editors and viewers (shui:-namespaced, SHACL-UI Widget Score-selected) plus groups
 * (sh:/st:-namespaced, selected by direct rdf:type match, see getGroupWidget). Exported so an
 * embedder can build a custom widget set by spreading this and overriding/removing/adding entries,
 * e.g. `{ ...defaultWidgets, editors: { ...defaultWidgets.editors, TextFieldEditor: MyWidget } }`.
 */
export const defaultWidgets: Widgets = {
  editors: buildEntries("editors"),
  viewers: buildEntries("viewers"),
  groups: buildGroupEntries(),
  facets: buildFacetEntries(),
};

export type WidgetMode = "edit" | "view" | "facet";

export function categoryFor(mode: WidgetMode, widgets: Widgets) {
  if (mode === "edit") return widgets.editors;
  if (mode === "view") return widgets.viewers;
  return widgets.facets;
}

// The inverse of categoryFor: which WidgetMode's pool a given shui:editor/shui:viewer/st:facet
// widgetPredicate resolves widgets from. Lets a caller (useWidget, score()'s category filter)
// derive the right mode straight from the predicate it's already scoring/resolving against,
// instead of trusting the ambient Environment.mode - the two usually coincide (edit mode always
// scores shui:editor, view always shui:viewer), but edit mode's read-only rendering deliberately
// resolves a shui:viewer widget while Environment.mode stays "edit", so they can't be conflated.
export function widgetModeForPredicate(widgetPredicate: Term): WidgetMode | undefined {
  if (widgetPredicate.equals(shui("editor"))) return "edit";
  if (widgetPredicate.equals(shui("viewer"))) return "view";
  if (widgetPredicate.equals(st("facet"))) return "facet";
  return undefined;
}

// widget-scoring.ttl and every score.ttl are static bundle contents - parsing them into an
// RdfStore is pure and (mode, widgets)-scoped, so repeat calls (one per property, on every render)
// reuse the same parsed graph instead of re-parsing the same turtle every time. Keyed by the
// `widgets` object's own identity (a WeakMap, same idiom as scoring/score.ts's shaclEngineCache):
// `defaultWidgets` is a stable module singleton so the common case caches exactly as before: a
// caller-supplied `widgets` object should likewise be constructed once and reused, not rebuilt on
// every render, or it never benefits from this cache.
const scoringGraphCache = new WeakMap<Widgets, Map<WidgetMode, Promise<RdfStore>>>();

/**
 * Combines the shared widget-scoring.ttl shape definitions with every editor's/viewer's/facet's
 * own scoringGraph (see Widgets) for the given mode into a single scoring graph. Groups never
 * contribute here - group widget selection doesn't score at all (see getGroupWidget).
 */
export function getScoringGraph(
  mode: WidgetMode,
  widgets: Widgets = defaultWidgets,
): Promise<RdfStore> {
  const modeCache = scoringGraphCache.get(widgets) ?? new Map<WidgetMode, Promise<RdfStore>>();
  scoringGraphCache.set(widgets, modeCache);

  const cached = modeCache.get(mode);
  if (cached) return cached;

  const categoryEntries = Object.values(categoryFor(mode, widgets));
  const turtle = [
    widgetScoringTtl,
    ...categoryEntries.map((entry) => entry.scoringGraph ?? ""),
  ].join("\n");
  const graph = parseRdf(turtle, "text/turtle");

  modeCache.set(mode, graph);
  return graph;
}

function findWidget<T extends { widget: NamedNode }>(
  entries: Record<string, T>,
  widget: NamedNode,
): T | undefined {
  return Object.values(entries).find((entry) => entry.widget.equals(widget));
}

/**
 * Resolves a shui:widget/st:widget IRI (as picked by PropertyUIElement.widget()) to the React
 * component implementing it, matched against the active `widgets`' own editors/viewers/facets
 * entries (by `mode`) by IRI equality (not by folder path - `widgets` need not be the bundled
 * `defaultWidgets` at all). The return type follows `mode`: callers that know their mode statically
 * (e.g. useWidget's own generic parameter) can narrow past the union themselves.
 */
export function getWidgetComponent(
  mode: WidgetMode,
  widget: NamedNode,
  widgets: Widgets = defaultWidgets,
): WidgetComponent | FacetWidgetComponent | undefined {
  return findWidget(categoryFor(mode, widgets), widget)?.Component;
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
  widgets: Widgets = defaultWidgets,
): WidgetMeta | undefined {
  return findWidget(widgets.editors, widget)?.meta ?? findWidget(widgets.viewers, widget)?.meta;
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
  widgets: Widgets = defaultWidgets,
): GroupWidgetRegistryEntry | undefined {
  const types = shapesGraph.getQuads(node, rdf("type")).map((quad) => quad.object);
  const matches = Object.values(widgets.groups).filter((entry) =>
    types.some((type) => type.equals(entry.widget)),
  );
  return matches.find((entry) => !entry.widget.equals(sh("PropertyGroup"))) ?? matches[0];
}
