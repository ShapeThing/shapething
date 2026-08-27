import type { NamedNode, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { parseRdf } from "@/helpers/rdf.ts";
import { rdf, sh, shui, st } from "@/helpers/namespaces.ts";
import type {
  GroupWidgetComponent,
  GroupWidgetRegistryEntry,
  WidgetComponent,
  WidgetMeta,
  WidgetRegistryEntry,
  Widgets,
} from "@/widgets/types.ts";
import widgetScoringTtl from "@/scoring/widget-scoring.ttl?raw";

const shuiEditorScoringGraphs = import.meta.glob(
  "@/widgets/implementations/shui/editors/*/score.ttl",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;
const shuiViewerScoringGraphs = import.meta.glob(
  "@/widgets/implementations/shui/viewers/*/score.ttl",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

const shuiEditorComponents = import.meta.glob(
  "@/widgets/implementations/shui/editors/*/widget.tsx",
  {
    eager: true,
    import: "default",
  },
) as Record<string, WidgetComponent>;
const shuiViewerComponents = import.meta.glob(
  "@/widgets/implementations/shui/viewers/*/widget.tsx",
  {
    eager: true,
    import: "default",
  },
) as Record<string, WidgetComponent>;

// Only editors ever produce a fresh/empty term for a property, so meta.ts (and createTerm)
// is an editor-only concept - viewers have nothing to create.
const shuiEditorMeta = import.meta.glob("@/widgets/implementations/shui/editors/*/meta.ts", {
  eager: true,
  import: "default",
}) as Record<string, WidgetMeta>;

// Groups aren't all under one namespace like editors/viewers are (shui:) - sh/groups/PropertyGroup
// and st/groups/CollapsiblePropertyGroup live side by side - so the glob is namespace-agnostic
// (a single `*` matches exactly one path segment) and each folder's namespace segment is resolved
// against this map to build its widget's real IRI.
const groupComponents = import.meta.glob("@/widgets/implementations/*/groups/*/widget.tsx", {
  eager: true,
  import: "default",
}) as Record<string, GroupWidgetComponent>;

const groupNamespaces: Record<string, (localName: string) => NamedNode> = {
  sh: (name) => sh(name),
  st: (name) => st(name),
};

// e.g. "/src/widgets/implementations/shui/editors/TextFieldEditor/widget.tsx" -> "TextFieldEditor"
function folderName(path: string): string {
  return path.split("/").at(-2)!;
}

// e.g. "/src/widgets/implementations/sh/groups/PropertyGroup/widget.tsx" -> "sh"
function namespaceSegment(path: string): string {
  return path.split("/").at(-4)!;
}

function buildEntries(
  components: Record<string, WidgetComponent>,
  scoringGraphs: Record<string, string>,
  meta: Record<string, WidgetMeta>,
): Record<string, WidgetRegistryEntry> {
  const entries: Record<string, WidgetRegistryEntry> = {};
  for (const [path, Component] of Object.entries(components)) {
    const name = folderName(path);
    entries[name] = {
      widget: shui(name),
      Component,
      meta: meta[path.replace(/widget\.tsx$/, "meta.ts")],
      scoringGraph: scoringGraphs[path.replace(/widget\.tsx$/, "score.ttl")],
    };
  }
  return entries;
}

function buildGroupEntries(
  components: Record<string, GroupWidgetComponent>,
): Record<string, GroupWidgetRegistryEntry> {
  const entries: Record<string, GroupWidgetRegistryEntry> = {};
  for (const [path, Component] of Object.entries(components)) {
    const name = folderName(path);
    const buildNamespace = groupNamespaces[namespaceSegment(path)];
    if (!buildNamespace) throw new Error(`Unknown group widget namespace for ${path}`);
    entries[name] = { widget: buildNamespace(name), Component };
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
  editors: buildEntries(shuiEditorComponents, shuiEditorScoringGraphs, shuiEditorMeta),
  viewers: buildEntries(shuiViewerComponents, shuiViewerScoringGraphs, {}),
  groups: buildGroupEntries(groupComponents),
};

export type WidgetMode = "edit" | "view";

// widget-scoring.ttl and every score.ttl are static bundle contents - parsing them into an
// RdfStore is pure and (mode, widgets)-scoped, so repeat calls (one per property, on every render)
// reuse the same parsed graph instead of re-parsing the same turtle every time. Keyed by the
// `widgets` object's own identity (a WeakMap, same idiom as scoring/score.ts's shaclEngineCache):
// `defaultWidgets` is a stable module singleton so the common case caches exactly as before: a
// caller-supplied `widgets` object should likewise be constructed once and reused, not rebuilt on
// every render, or it never benefits from this cache.
const scoringGraphCache = new WeakMap<Widgets, Map<WidgetMode, Promise<RdfStore>>>();

/**
 * Combines the shared widget-scoring.ttl shape definitions with every editor/viewer's own
 * scoringGraph (see Widgets) for the given mode into a single scoring graph. Groups never
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

  const categoryEntries = Object.values(mode === "edit" ? widgets.editors : widgets.viewers);
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
 * Resolves a shui:widget IRI (as picked by PropertyUIElement.widget()) to the React component
 * implementing it, matched against the active `widgets`' own `editors`/`viewers` entries by IRI
 * equality (not by folder path - `widgets` need not be the bundled `defaultWidgets` at all).
 */
export function getWidgetComponent(
  mode: WidgetMode,
  widget: NamedNode,
  widgets: Widgets = defaultWidgets,
): WidgetComponent | undefined {
  return findWidget(mode === "edit" ? widgets.editors : widgets.viewers, widget)?.Component;
}

/**
 * Resolves an editor widget IRI to its meta.ts (see WidgetMeta) - `undefined` both when the
 * widget has no meta.ts and when it has one that declares no createTerm override.
 */
export function getWidgetMeta(
  widget: NamedNode,
  widgets: Widgets = defaultWidgets,
): WidgetMeta | undefined {
  return findWidget(widgets.editors, widget)?.meta;
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
