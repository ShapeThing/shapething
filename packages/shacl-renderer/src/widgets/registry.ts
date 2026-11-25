import type { NamedNode, Quad, Term } from "@rdfjs/types";
import { lazyWidget } from "@/widgets/lazyWidget.ts";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { decodeQuads, storeFromGraphSources, type EncodedQuads } from "@/helpers/quadTuples.ts";
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
// Turtle parsed at build time (see build/ttlQuadsPlugin.ts) - no parser runs for these in the browser.
import widgetScoringEncoded from "@/scoring/widget-scoring.ttl?quads";
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
// Editors, viewers and facets are each loaded on demand (one dynamic import per widget, see
// lazyWidget.ts): a form only ever downloads the widgets its shapes actually resolve to - view
// mode none of the editors, an edit form without durations not the Temporal polyfill, and so on.
// That costs no extra round trip: widget resolution preloads the picked widget's code while
// scoring the rest of the form, so it's in by the time the slot renders. Picking a widget never
// needs its code - scoring reads only score.ttl (and meta.ts, which stays eager and small).
const componentLoaders = import.meta.glob([
  "/src/widgets/implementations/*/editors/*/widget.tsx",
  "/src/widgets/implementations/*/viewers/*/widget.tsx",
  "/src/widgets/implementations/*/facets/*/widget.tsx",
]) as Record<string, () => Promise<{ default: WidgetComponent | FacetWidgetComponent }>>;

// Groups render synchronously from the element tree (see GroupUIElementComponent), with no
// resolution query to preload through, and are small - so they stay eager.
const groupComponents = import.meta.glob("/src/widgets/implementations/*/groups/*/widget.tsx", {
  eager: true,
  import: "default",
}) as Record<string, GroupWidgetComponent>;

const scoringGraphs = decodeAll(
  import.meta.glob("/src/widgets/implementations/*/*/*/score.ttl", {
    eager: true,
    query: "?quads",
    import: "default",
  }) as Record<string, EncodedQuads>,
);

const widgetScoringQuads = decodeQuads(widgetScoringEncoded);

function decodeAll(encoded: Record<string, EncodedQuads>): Record<string, Quad[]> {
  return Object.fromEntries(Object.entries(encoded).map(([path, e]) => [path, decodeQuads(e)]));
}

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
  for (const [path, load] of Object.entries(componentLoaders)) {
    if (categorySegment(path) !== category) continue;
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: lazyWidget(load as () => Promise<{ default: WidgetComponent }>),
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
  for (const [path, load] of Object.entries(componentLoaders)) {
    if (categorySegment(path) !== "facets") continue;
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component: lazyWidget(load as () => Promise<{ default: FacetWidgetComponent }>),
      scoringGraph: scoringGraphs[path.replace(/widget\.tsx$/, "score.ttl")],
    };
  }
  return entries;
}

// A group's meta.ttl describes the group type itself (its rdfs:subClassOf sh:PropertyGroup, see
// GroupWidgetRegistryEntry.metaGraph) - it carries no score, groups don't score.
const groupMetaGraphs = decodeAll(
  import.meta.glob("/src/widgets/implementations/*/groups/*/meta.ttl", {
    eager: true,
    query: "?quads",
    import: "default",
  }) as Record<string, EncodedQuads>,
);

function buildGroupEntries(): Record<string, GroupWidgetRegistryEntry> {
  const entries: Record<string, GroupWidgetRegistryEntry> = {};
  for (const [path, Component] of Object.entries(groupComponents)) {
    entries[folderName(path)] = {
      widget: widgetIri(path),
      Component,
      metaGraph: groupMetaGraphs[path.replace(/widget\.tsx$/, "meta.ttl")],
    };
  }
  return entries;
}

/**
 * Every widget bundled with this library, organized exactly like `Environment.widgets`/`Widgets`
 * itself - editors and viewers (shui:-namespaced, SHACL-UI Widget Score-selected) plus groups
 * (sh:/st:-namespaced, selected by rdf:type match, see getGroupWidget). Exported so an
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
export { categoryFor, widgetModeForEnvironment, widgetModeForPredicate } from "@/widgets/lookup.ts";

// widget-scoring.ttl and every score.ttl are static bundle contents - building them into an
// RdfStore is pure and (modes, widgets)-scoped, so every caller (one per property, on every
// render, and every renderer instance on the page) shares the same store. That shared identity
// matters beyond the build itself: validation/validate.ts caches the compiled ShaclEngine per
// store identity, so a stable scoring store means the scoring engine compiles once per page
// instead of once per renderer. Keyed by the `widgets` object's own identity (a WeakMap):
// `defaultWidgets` is a stable module singleton so the common case always hits; a caller-supplied
// `widgets` object should likewise be constructed once and reused, not rebuilt on every render.
const scoringGraphCache = new WeakMap<Widgets, Map<string, Promise<RdfStore>>>();

/**
 * Combines the shared widget-scoring.ttl shape definitions with every editor's/viewer's/facet's
 * own scoringGraph (see Widgets) for the given mode - or several modes, e.g. edit mode that also
 * needs viewer rules for read-only values - into a single scoring graph. Groups never contribute
 * here - group widget selection doesn't score at all (see getGroupWidget).
 */
export function getScoringGraph(
  modes: WidgetMode | WidgetMode[],
  widgets: Widgets = defaultWidgets,
): Promise<RdfStore> {
  const modeList = Array.isArray(modes) ? modes : [modes];
  const key = modeList.join("+");
  const modeCache = scoringGraphCache.get(widgets) ?? new Map<string, Promise<RdfStore>>();
  scoringGraphCache.set(widgets, modeCache);

  const cached = modeCache.get(key);
  if (cached) return cached;

  const graph = storeFromGraphSources([
    widgetScoringQuads,
    ...modeList.flatMap((mode) =>
      Object.values(categoryFor(mode, widgets)).map((entry) => entry.scoringGraph),
    ),
  ]);

  modeCache.set(key, graph);
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
