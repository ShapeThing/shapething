import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

// Puts `item` as a sequence step right before/after `path`. When `path` already is a sequence the
// step is spliced into it rather than nesting a sequence inside a sequence - (a (b c)) means the
// same as (a b c), so the flat form is the one worth writing.
// The same goes for a sequence being inserted (dragged in) - see stepsOf.
export function withStepAround(
  path: PropertyPath,
  item: PropertyPath,
  side: "before" | "after",
): PropertyPath {
  const items = stepsOf(path);
  const inserted = stepsOf(item);
  return {
    type: "sequence",
    items: side === "before" ? [...inserted, ...items] : [...items, ...inserted],
  };
}

function stepsOf(path: PropertyPath): PropertyPath[] {
  return path.type === "sequence" ? path.items : [path];
}

export function withItemInserted<T extends Extract<PropertyPath, { items: PropertyPath[] }>>(
  path: T,
  index: number,
  item: PropertyPath,
): T {
  const inserted = path.type === "sequence" ? stepsOf(item) : [item];
  return {
    ...path,
    items: [...path.items.slice(0, index), ...inserted, ...path.items.slice(index)],
  };
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

// The steps from the root down to a node: an index into a list's items, or "path" into a wrapper.
export type Location = (number | "path")[];

export function isWithin(location: Location, ancestor: Location): boolean {
  return ancestor.every((step, i) => location[i] === step);
}

export function getAt(root: PropertyPath, location: Location): PropertyPath {
  return location.reduce<PropertyPath>((node, step) => {
    if (step === "path" && "path" in node) return node.path;
    if (typeof step === "number" && "items" in node) return node.items[step];
    throw new Error(`No path node at ${location.join("/")}`);
  }, root);
}

export function updateAt(
  root: PropertyPath,
  location: Location,
  update: (node: PropertyPath) => PropertyPath,
): PropertyPath {
  if (location.length === 0) return update(root);
  const [step, ...rest] = location;
  if (step === "path" && "path" in root) {
    return { ...root, path: updateAt(root.path, rest, update) };
  }
  if (typeof step === "number" && "items" in root) {
    return withItemReplaced(root, step, updateAt(root.items[step], rest, update));
  }
  throw new Error(`No path node at ${location.join("/")}`);
}

// Takes the node out of its parent: a list loses the item (collapsing when one is left), a wrapper
// goes along with its only child. `null` when that reaches the root, which empties the value.
export function removeAt(root: PropertyPath, location: Location): PropertyPath | null {
  if (location.length === 0) return null;
  const parent = location.slice(0, -1);
  const step = location[location.length - 1];
  if (step === "path") return removeAt(root, parent);
  return updateAt(root, parent, (list) => withItemRemoved(list as ListPath, step));
}

function locationOf(root: PropertyPath, target: PropertyPath): Location | null {
  if (root === target) return [];
  const children: [Location[number], PropertyPath][] =
    "items" in root
      ? root.items.map((item, i) => [i, item])
      : "path" in root
        ? [["path", root.path]]
        : [];
  for (const [step, child] of children) {
    const found = locationOf(child, target);
    if (found) return [step, ...found];
  }
  return null;
}

// Puts `item` right before/after the node at `target`, as its sibling: another item of the list
// it's in (a new step of a sequence, a new branch of an alternative), or, where there's no list
// around it (the root, a wrapper's inner path), a sequence step next to it.
export function withInsertedBeside(
  root: PropertyPath,
  target: Location,
  side: "before" | "after",
  item: PropertyPath,
): PropertyPath {
  const step = target[target.length - 1];
  if (typeof step !== "number") {
    return updateAt(root, target, (node) => withStepAround(node, item, side));
  }
  return updateAt(root, target.slice(0, -1), (list) =>
    withItemInserted(list as ListPath, side === "before" ? step : step + 1, item),
  );
}

// Moves the node at `from` to wherever `insert` puts it. The node is first swapped for a
// placeholder, so every sibling keeps its index and `insert`'s own location stays valid; the
// placeholder is removed (found back by identity) once the node has landed.
export function withMoved(
  root: PropertyPath,
  from: Location,
  insert: (root: PropertyPath, item: PropertyPath) => PropertyPath,
): PropertyPath {
  const item = getAt(root, from);
  const placeholder: PropertyPath = { ...item };
  const inserted = insert(
    updateAt(root, from, () => placeholder),
    item,
  );
  const placeholderAt = locationOf(inserted, placeholder);
  return (placeholderAt && removeAt(inserted, placeholderAt)) ?? inserted;
}
