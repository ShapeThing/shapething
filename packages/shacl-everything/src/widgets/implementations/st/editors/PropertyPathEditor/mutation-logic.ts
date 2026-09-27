import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

// Puts `item` as a sequence step right before/after `path`. When `path` already is a sequence the
// step is spliced into it rather than nesting a sequence inside a sequence - (a (b c)) means the
// same as (a b c), so the flat form is the one worth writing.
export function withStepAround(
  path: PropertyPath,
  item: PropertyPath,
  side: "before" | "after",
): PropertyPath {
  const items = path.type === "sequence" ? path.items : [path];
  return { type: "sequence", items: side === "before" ? [item, ...items] : [...items, item] };
}

export function withItemInserted<T extends Extract<PropertyPath, { items: PropertyPath[] }>>(
  path: T,
  index: number,
  item: PropertyPath,
): T {
  return { ...path, items: [...path.items.slice(0, index), item, ...path.items.slice(index)] };
}

// A sequence/alternative needs at least two items, so dropping to one collapses it into that item.
export function withItemRemoved(
  path: Extract<PropertyPath, { items: PropertyPath[] }>,
  index: number,
): PropertyPath {
  const items = path.items.filter((_, i) => i !== index);
  return items.length === 1 ? items[0] : { ...path, items };
}

export function withItemReplaced<T extends Extract<PropertyPath, { items: PropertyPath[] }>>(
  path: T,
  index: number,
  item: PropertyPath,
): T {
  return { ...path, items: path.items.map((current, i) => (i === index ? item : current)) };
}

type ListPath = Extract<PropertyPath, { items: PropertyPath[] }>;
type WrapperPath = Extract<PropertyPath, { path: PropertyPath }>;

const LIST_TYPES: ListPath["type"][] = ["sequence", "alternative"];
const WRAPPER_TYPES: WrapperPath["type"][] = ["inverse", "zeroOrMore", "oneOrMore", "zeroOrOne"];

export const PATH_TYPES: PropertyPath["type"][] = ["predicate", ...LIST_TYPES, ...WRAPPER_TYPES];

// Only "predicate" can be out of reach: a wrapper around a single predicate unwraps to it, but
// nothing else has one predicate to become.
export function canSwitchTo(path: PropertyPath, type: PropertyPath["type"]): boolean {
  if (type !== "predicate") return true;
  return path.type === "predicate" || ("path" in path && path.path.type === "predicate");
}

// A non-list becoming a sequence/alternative would be a one-item list, which isn't a valid SHACL
// path, so it needs a second item first - see withType's `secondItem`.
export function needsSecondItem(path: PropertyPath, type: PropertyPath["type"]): boolean {
  return (LIST_TYPES as string[]).includes(type) && !("items" in path);
}

// Lists swap among lists keeping their items, wrappers among wrappers keeping their inner path.
// Anything else switching to a wrapper gets wrapped as a whole (a/b becomes ^(a/b)), and to a list
// becomes that list's first item, followed by `secondItem`.
export function withType(
  path: PropertyPath,
  type: PropertyPath["type"],
  secondItem?: PropertyPath,
): PropertyPath {
  if (type === path.type) return path;
  if ((LIST_TYPES as string[]).includes(type)) {
    const listType = type as ListPath["type"];
    if ("items" in path) return { type: listType, items: path.items };
    return secondItem ? { type: listType, items: [path, secondItem] } : path;
  }
  if ((WRAPPER_TYPES as string[]).includes(type)) {
    const wrapperType = type as WrapperPath["type"];
    return "path" in path ? { type: wrapperType, path: path.path } : { type: wrapperType, path };
  }
  // To predicate: only reachable from a wrapper around one (see canSwitchTo).
  return "path" in path && path.path.type === "predicate" ? path.path : path;
}
