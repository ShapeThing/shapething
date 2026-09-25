import type { Term } from "@rdfjs/types";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { termKey } from "@/helpers/termKey.ts";

/**
 * ShaclRenderer's props split in two (see render.tsx):
 *
 * - **Live** props (LIVE_PROPS) are pure UI/behavior switches nothing in preprocessing reads - a
 *   change is simply merged into the Environment on the next render, keeping the form and its
 *   in-progress edits. `onSubmit` is live too, but handed down as a stable wrapper that always
 *   calls the latest callback, so an inline arrow function neither goes stale nor re-renders the
 *   whole form on every parent render.
 * - Every other prop is an **identity** prop: it feeds preprocessing (graphs, focusNode,
 *   nodeShapes, mode, widgets, languages, ...), so a change rebuilds the Environment from scratch -
 *   a new edit session, discarding unsubmitted edits, the same as remounting with a new `key`.
 */
export const LIVE_PROPS = [
  "onSubmit",
  "interfaceLanguage",
  "viewModeLabelLayout",
  "enableWidgetSwitching",
  "enableLogicalBranchSwitching",
  "enableAlternativePathSwitching",
  "enableContentLanguageCreation",
  "enableShPathInLabelTitle",
  "enableFullLanguageRemoval",
  "enableEditInPlace",
  "enableCreateInPlace",
  "enableLinksToResources",
  "enableUndoRedo",
  "facetChangeMode",
  "enableFacetTypeUnion",
  "enableFacetOptionCounts",
  "enableFacetSearchForAutocomplete",
  "mapStyleUrl",
] as const satisfies readonly (keyof RawEnvironment)[];

const liveProps = new Set<string>(LIVE_PROPS);

export type LiveProps = Partial<Pick<RawEnvironment, (typeof LIVE_PROPS)[number]>>;

/**
 * Every live prop's current value, `onSubmit` excluded (the caller wraps that one itself). An
 * absent prop falls back to defaultEnvironment's value - not to whatever it was at mount - so
 * removing a prop really does restore the default.
 */
export function pickLiveProps(props: Record<string, unknown>): LiveProps {
  const defaults = defaultEnvironment as unknown as Record<string, unknown>;
  const live: Record<string, unknown> = {};
  for (const key of LIVE_PROPS) {
    if (key === "onSubmit") continue;
    const value = props[key] ?? defaults[key];
    if (value !== undefined) live[key] = value;
  }
  return live as LiveProps;
}

const objectIds = new WeakMap<object, number>();
let nextObjectId = 0;
const serializedArrays = new WeakMap<readonly unknown[], string>();

const isTerm = (value: object): value is Term =>
  "termType" in value && typeof (value as Term).termType === "string";

// Structural where an embedder plausibly rebuilds an equal value every render (terms, arrays of
// terms/quads, plain objects like a widget registry spread, URLs, strings), by identity for class
// instances (an RdfStore: a new store *is* new data). Functions all compare equal - an inline
// locale loader or widget component must not rebuild the whole form on every parent render.
function serialize(value: unknown): string {
  if (value === undefined) return "u";
  if (value === null) return "n";
  if (typeof value === "function") return "f";
  if (typeof value !== "object") return JSON.stringify(value);
  if (value instanceof URL) return `url:${value.href}`;
  if (isTerm(value)) {
    if (value.termType === "Quad") {
      const quad = value as unknown as { subject: Term; predicate: Term; object: Term; graph: Term };
      return `<<${[quad.subject, quad.predicate, quad.object, quad.graph].map(serialize).join(" ")}>>`;
    }
    return termKey(value);
  }
  if (Array.isArray(value)) {
    const cached = serializedArrays.get(value);
    if (cached !== undefined) return cached;
    const serialized = `[${value.map(serialize).join(",")}]`;
    serializedArrays.set(value, serialized);
    return serialized;
  }
  if (Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serialize((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  let id = objectIds.get(value);
  if (id === undefined) {
    id = ++nextObjectId;
    objectIds.set(value, id);
  }
  return `#${id}`;
}

// FNV-1a - keeps the key short (it's a React key and part of a query key) even when an identity
// prop is a whole Turtle document passed as a string.
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** A key that changes exactly when an identity prop (anything not in LIVE_PROPS) changes. */
export function identityKey(props: Record<string, unknown>): string {
  const serialized = Object.keys(props)
    .filter((key) => !liveProps.has(key) && props[key] !== undefined)
    .sort()
    .map((key) => `${key}=${serialize(props[key])}`)
    .join("&");
  return `${hash(serialized)}-${serialized.length.toString(36)}`;
}
