import type { Literal, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf, xsd } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";

export type DiffStatus = "added" | "removed";

export type PropertyDiff = {
  // Whether `value` was added or removed by the change - undefined when it's unchanged.
  status: (value: Term) => DiffStatus | undefined;
  // Set when the change swapped exactly one text value for another (see diffForValues) - rendered
  // as one value with the edit marked inside it, instead of a removed and an added value.
  changedText?: { removed: Literal; added: Literal };
};

const isText = (term: Term): term is Literal =>
  term.termType === "Literal" &&
  (term.datatype.equals(xsd("string")) || term.datatype.equals(rdf("langString")));

/**
 * How `values` - the values view mode is about to render for `property`, out of the widened
 * dataGraph (see preprocess/diff.ts) - relate to Environment.additionsGraph/deletionsGraph: each
 * path is walked in the data as it is now and as it was before, so a value only reachable before
 * was removed and one only reachable now was added, whatever the path's shape. When exactly one of
 * the shown values was removed and one added, and both are xsd:string/rdf:langString literals, it
 * reads as one text that was edited, so they're paired up as `changedText`.
 */
export function diffForValues(
  property: PropertyUIElement,
  values: Term[],
  graphs: { current: RdfStore; previous: RdfStore },
): PropertyDiff {
  const path = property.propertyPath();
  const reachable = (graph: RdfStore) =>
    path ? walkPropertyPath(path, property.focusNode, graph) : [];
  const now = reachable(graphs.current);
  const before = reachable(graphs.previous);
  const status = (value: Term): DiffStatus | undefined => {
    const inNow = now.some((term) => term.equals(value));
    const inBefore = before.some((term) => term.equals(value));
    if (inNow && !inBefore) return "added";
    if (inBefore && !inNow) return "removed";
    return undefined;
  };

  const removed = values.filter((value) => status(value) === "removed");
  const added = values.filter((value) => status(value) === "added");
  const changedText =
    removed.length === 1 && added.length === 1 && isText(removed[0]) && isText(added[0])
      ? { removed: removed[0], added: added[0] }
      : undefined;

  return { status, changedText };
}
