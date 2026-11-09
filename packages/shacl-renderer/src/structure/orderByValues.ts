import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { st, xsd } from "@/helpers/namespaces.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { insertPropertyPath } from "@/structure/paths/insertPropertyPath.ts";
import {
  isUnsetPathNode,
  parsePathNode,
  type PropertyPath,
} from "@/structure/paths/parsePropertyPath.ts";
import { replacePropertyPath } from "@/structure/paths/replacePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * st:orderBy on a property shape: its object is a property path (same syntax as sh:path),
 * walked from each of the property's values to find that value's position - e.g. st:orderBy
 * sh:order lists a node shape's sh:property values by each property shape's own sh:order.
 */
export function orderByPath(propertyUIElement: PropertyUIElement): PropertyPath | undefined {
  // keepFirst (constraintResolutions.ts) resolves st:orderBy to a single term, but st() isn't
  // literal-typed, so get()'s PredicateReturn can't know that and falls back to Term[].
  const node = propertyUIElement.get(st("orderBy")) as unknown as Term | undefined;
  if (!node || node.termType === "Literal") return undefined;
  if (isUnsetPathNode(node, propertyUIElement.shapesGraph)) return undefined;
  return parsePathNode(node, propertyUIElement.shapesGraph);
}

/**
 * st:orderDirection st:Descending on a property shape with st:orderBy: view mode lists the values
 * from the highest position to the lowest (values without a position still last). Anything else,
 * or nothing, is ascending. Edit mode ignores it: drag reordering writes positions 1..n.
 */
export function orderDescending(propertyUIElement: PropertyUIElement): boolean {
  const node = propertyUIElement.get(st("orderDirection")) as unknown as Term | undefined;
  return node?.equals(st("Descending")) ?? false;
}

// Only the path shapes insertPropertyPath/replacePropertyPath can write through - see their docs.
export function isWritablePath(path: PropertyPath): boolean {
  switch (path.type) {
    case "predicate":
      return true;
    case "inverse":
      return isWritablePath(path.path);
    case "sequence":
      return path.items.every(isWritablePath);
    default:
      return false;
  }
}

function readPosition(value: Term, path: PropertyPath, dataGraph: RdfStore): number | undefined {
  if (value.termType === "Literal") return undefined;
  for (const term of walkPropertyPath(path, value, dataGraph)) {
    if (term.termType !== "Literal") continue;
    const parsed = parseFloat(term.value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

/**
 * `objects` sorted ascending by their st:orderBy position. Stable, so values without a position
 * (sorted last) - or sharing one - keep the order they came in with.
 */
export function sortByOrderPath(objects: Term[], path: PropertyPath, dataGraph: RdfStore): Term[] {
  const positions = new Map(
    objects.map((object) => [object, readPosition(object, path, dataGraph)]),
  );
  return [...objects].sort((a, b) => {
    const positionA = positions.get(a);
    const positionB = positions.get(b);
    if (positionA === undefined) return positionB === undefined ? 0 : 1;
    if (positionB === undefined) return -1;
    return positionA - positionB;
  });
}

/**
 * View mode's order of a property's values: by their st:orderBy position when the property has
 * one (values without a position last), and otherwise - as well as between values sharing a
 * position, or both without one - alphabetically by `labelOf` (the label the viewer shows), as
 * readers of `locale` sort: "Émile" with the E's, "Book 2" before "Book 10". RDF values have no
 * order of their own, so without this they would be in whatever order the data happened to give.
 *
 * With `descending` (st:orderDirection st:Descending) the positions go from high to low; values
 * without one stay last, and equal positions stay alphabetical.
 *
 * Edit mode keeps sortByOrderPath alone: there, without st:orderBy, values stay in the order they
 * were added in, and sorting by label would move a value away while it is being typed.
 */
export function sortForView(
  objects: Term[],
  path: PropertyPath | undefined,
  dataGraph: RdfStore,
  labelOf: (term: Term) => string,
  locale: string,
  descending = false,
): Term[] {
  const collator = collatorFor(locale);
  const keys = new Map(
    objects.map((object) => [
      object,
      {
        position: path ? readPosition(object, path, dataGraph) : undefined,
        label: labelOf(object),
      },
    ]),
  );
  return [...objects].sort((a, b) => {
    const keyA = keys.get(a)!;
    const keyB = keys.get(b)!;
    if (keyA.position !== keyB.position) {
      if (keyA.position === undefined) return 1;
      if (keyB.position === undefined) return -1;
      return descending ? keyB.position - keyA.position : keyA.position - keyB.position;
    }
    return collator.compare(keyA.label, keyB.label);
  });
}

// A language tag Intl does not accept (an empty or wildcard content language) sorts as the
// runtime's default locale does.
function collatorFor(locale: string): Intl.Collator {
  const options: Intl.CollatorOptions = { numeric: true, sensitivity: "base" };
  try {
    return new Intl.Collator(locale || undefined, options);
  } catch {
    return new Intl.Collator(undefined, options);
  }
}

/**
 * Renumbers `objects` 1..n in the order given, as one undoable write. Values already holding
 * their new position are left untouched.
 */
export function writeOrder(objects: Term[], path: PropertyPath, dataGraph: RdfStore): void {
  transact(dataGraph, () => {
    objects.forEach((object, index) => {
      if (object.termType === "Literal") return;
      const subject = object as Quad_Subject;
      const position = index + 1;
      if (readPosition(subject, path, dataGraph) === position) return;

      const newValue = factory.literal(String(position), xsd("integer"));
      const [existing] = walkPropertyPath(path, subject, dataGraph);
      if (existing) replacePropertyPath(path, subject, dataGraph, existing, newValue);
      else insertPropertyPath(path, subject, dataGraph, newValue);
    });
  });
}
