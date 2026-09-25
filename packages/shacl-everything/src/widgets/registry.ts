import type { NamedNode, Term } from "@rdfjs/types";
import { lazy } from "react";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { prefixes } from "@/helpers/namespaces.ts";
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
import {
  categoryFor,
  getGroupWidget as lookupGroupWidget,
  getWidgetComponent as lookupWidgetComponent,
  getWidgetMeta as lookupWidgetMeta,
  type WidgetMode,
} from "@/widgets/lookup.ts";

// Every widget implementation lives at implementations/<namespace>/<category>/<Name>/ - e.g.
// shui/editors/TextFieldEditor or st/groups/CollapsiblePropertyGroup. `category` is which of
// Widgets' three buckets (editors/viewers/groups) the widget registers under; `namespace` is
// which RDF vocabulary its IRI belongs to. Neither is fixed to one value up front (editors/viewers
// aren't hardcoded to shui: any more than groups are hardcoded to sh:/st:) - both are read off the
// path generically, so a new namespace or category folder under implementations/ is picked up
// without touching this file. The namespace folder name must be a prefix registered in
// helpers/namespaces.ts's `prefixes` (its own alias, e.g. "sh"/"shui"/"st") - that's the single
// source of truth for which IRI a namespace folder resolves to.
//
// A handful of editors/viewers pull in dependencies heavy enough (MapViewer/GeoEditor's
// maplibre-gl+geoman+maplibre-gl-geo-editor, RichTextEditor/HTMLViewer's tiptap+prosemirror) that
// bundling every widget eagerly forced every consumer to pay for all of them regardless of which
// widgets their shapes actually use - these four are loaded lazily instead (one dynamic import
// per widget, wrapped in React.lazy below). Every other editor/viewer is small enough that a
// dynamic-import round trip would only add latency (see WidgetSlot's Suspense boundary) for no
// real size win, so they - and groups, which have no heavy outliers of their own - stay eager,
// same as before. If a future widget turns out to pull in something similarly heavy, add its path
// to both lists below.
const lazyComponentLoaders = import.meta.glob([
  "/src/widgets/implementations/st/viewers/MapViewer/widget.tsx",
  "/src/widgets/implementations/st/editors/GeoEditor/widget.tsx",
  "/src/widgets/implementations/shui/editors/RichTextEditor/widget.tsx",
  "/src/widgets/implementations/shui/viewers/HTMLViewer/widget.tsx",
  "/src/widgets/implementations/st/editors/EditorJsEditor/widget.tsx",
]) as Record<string, () => Promise<{ default: WidgetComponent }>>;

// MapFacet shares MapViewer/GeoEditor's own maplibre-gl+geoman+maplibre-gl-geo-editor footprint -
// same "don't force it on every consumer" reasoning as the editors/viewers above, kept as its own
// typed glob (rather than folded into lazyComponentLoaders) since a facet's Component is a
// FacetWidgetComponent, not a WidgetComponent - see buildFacetEntries below.
const lazyFacetComponentLoaders = import.meta.glob([
  "/src/widgets/implementations/st/facets/MapFacet/widget.tsx",
]) as Record<string, () => Promise<{ default: FacetWidgetComponent }>>;

const eagerComponents = import.meta.glob(
  [
    "/src/widgets/implementations/*/*/*/widget.tsx",
    "!/src/widgets/implementations/st/viewers/MapViewer/widget.tsx",
    "!/src/widgets/implementations/st/editors/GeoEditor/widget.tsx",
    "!/src/widgets/implementations/shui/editors/RichTextEditor/widget.tsx",
    "!/src/widgets/implementations/shui/viewers/HTMLViewer/widget.tsx",
    "!/src/widgets/implementations/st/facets/MapFacet/widget.tsx",
    "!/src/widgets/implementations/st/editors/EditorJsEditor/widget.tsx",
  ],
  { eager: true, import: "default" },
) as Record<
  string,
  WidgetComponent | GroupWidgetComponent | FacetWidgetComponent
>;

const scoringGraphs = import.meta.glob(
  "/src/widgets/implementations/*/*/*/score.ttl",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

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

function buildEntries(
  category: "editors" | "viewers",
): Record<string, WidgetRegistryEntry> {
  const entries: Record<string, WidgetRegistryEntry> = {};
  for (const [path, Component] of Object.entries(eagerComponents)) {
    if (categorySegment(path) !== category) continue;
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: Component as WidgetComponent,
      meta: meta[path.replace(/widget\.tsx$/, "meta.ts")],
      scoringGraph: scoringGraphs[path.replace(/widget\.tsx$/, "score.ttl")],
    };
  }
  for (const [path, load] of Object.entries(lazyComponentLoaders)) {
    if (categorySegment(path) !== category) continue;
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: lazy(load),
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
  for (const [path, Component] of Object.entries(eagerComponents)) {
    if (categorySegment(path) !== "facets") continue;
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: Component as FacetWidgetComponent,
      scoringGraph: scoringGraphs[path.replace(/widget\.tsx$/, "score.ttl")],
    };
  }
  for (const [path, load] of Object.entries(lazyFacetComponentLoaders)) {
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: lazy(load),
      scoringGraph: scoringGraphs[path.replace(/widget\.tsx$/, "score.ttl")],
    };
  }
  return entries;
}

function buildGroupEntries(): Record<string, GroupWidgetRegistryEntry> {
  const entries: Record<string, GroupWidgetRegistryEntry> = {};
  for (const [path, Component] of Object.entries(eagerComponents)) {
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

export type { WidgetMode } from "@/widgets/lookup.ts";
export { categoryFor, widgetModeForPredicate } from "@/widgets/lookup.ts";

// widget-scoring.ttl and every score.ttl are static bundle contents - parsing them into an
// RdfStore is pure and (mode, widgets)-scoped, so repeat calls (one per property, on every render)
// reuse the same parsed graph instead of re-parsing the same turtle every time. Keyed by the
// `widgets` object's own identity (a WeakMap, same idiom as validation/validate.ts's shaclEngineCache):
// `defaultWidgets` is a stable module singleton so the common case caches exactly as before: a
// caller-supplied `widgets` object should likewise be constructed once and reused, not rebuilt on
// every render, or it never benefits from this cache.
const scoringGraphCache = new WeakMap<
  Widgets,
  Map<WidgetMode, Promise<RdfStore>>
>();

/**
 * Combines the shared widget-scoring.ttl shape definitions with every editor's/viewer's/facet's
 * own scoringGraph (see Widgets) for the given mode into a single scoring graph. Groups never
 * contribute here - group widget selection doesn't score at all (see getGroupWidget).
 */
export function getScoringGraph(
  mode: WidgetMode,
  widgets: Widgets = defaultWidgets,
): Promise<RdfStore> {
  const modeCache = scoringGraphCache.get(widgets) ??
    new Map<WidgetMode, Promise<RdfStore>>();
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

// The registry-lookup functions themselves live in widgets/lookup.ts, which takes `widgets` as a
// required argument and imports no widget implementation (or React) at all - so the structure/
// model layer can resolve a widget's meta/group entry from whatever registry it was handed without
// pulling every bundled widget in. These wrappers only add the `defaultWidgets` fallback, for
// callers (tests, one-off tooling) that genuinely mean "the bundled set".

export function getWidgetComponent(
  mode: WidgetMode,
  widget: NamedNode,
  widgets: Widgets = defaultWidgets,
): WidgetComponent | FacetWidgetComponent | undefined {
  return lookupWidgetComponent(mode, widget, widgets);
}

export function getWidgetMeta(
  widget: NamedNode,
  widgets: Widgets = defaultWidgets,
): WidgetMeta | undefined {
  return lookupWidgetMeta(widget, widgets);
}

export function getGroupWidget(
  node: Term,
  shapesGraph: RdfStore,
  widgets: Widgets = defaultWidgets,
): GroupWidgetRegistryEntry | undefined {
  return lookupGroupWidget(node, shapesGraph, widgets);
}
