// A path node's own type conversion, keeping as much of its current content as makes sense
// rather than discarding it: swapping between the unary wrapper types (inverse/zeroOrMore/
// oneOrMore/zeroOrOne) keeps the same wrapped path instead of nesting one wrapper inside another,
// switching to sequence/alternative starts a one-item list holding the current path (grown further
// via "Add Item"), and switching back to a bare predicate walks down to the first predicate it

import { rdf } from "@/helpers/namespaces.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

// still contains.
export function convertPathType(path: PropertyPath, newType: PropertyPath["type"]): PropertyPath {
  if (path.type === newType) return path;

  switch (newType) {
    case "predicate":
      return collapseToPredicate(path);
    case "sequence":
    case "alternative":
      return { type: newType, items: [path] };
    case "inverse":
    case "zeroOrMore":
    case "oneOrMore":
    case "zeroOrOne":
      return { type: newType, path: unwrapSingle(path) };
  }
}

export function unwrapSingle(path: PropertyPath): PropertyPath {
  switch (path.type) {
    case "inverse":
    case "zeroOrMore":
    case "oneOrMore":
    case "zeroOrOne":
      return path.path;
    default:
      return path;
  }
}

export function collapseToPredicate(path: PropertyPath): PropertyPath {
  switch (path.type) {
    case "predicate":
      return path;
    case "sequence":
    case "alternative":
      return collapseToPredicate(path.items[0]);
    case "inverse":
    case "zeroOrMore":
    case "oneOrMore":
    case "zeroOrOne":
      return collapseToPredicate(path.path);
  }
}

export function updateItem(
  items: PropertyPath[],
  index: number,
  newItem: PropertyPath,
): PropertyPath[] {
  return items.map((item, i) => (i === index ? newItem : item));
}

// Dropping a sequence/alternative down to its last remaining item collapses the now-pointless
// wrapper entirely rather than leaving a one-item list around - a one-item sequence/alternative
// means exactly the same thing as that item alone.
export function withItemRemoved(
  path: Extract<PropertyPath, { type: "sequence" | "alternative" }>,
  index: number,
): PropertyPath {
  const remaining = path.items.filter((_, i) => i !== index);
  return remaining.length === 1 ? remaining[0] : { ...path, items: remaining };
}

export function defaultPredicatePath(): Extract<PropertyPath, { type: "predicate" }> {
  return { type: "predicate", predicate: rdf("type") };
}
