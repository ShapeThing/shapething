import type { Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

/**
 * Removes `value` for `path` starting at `focusNode` from `dataGraph` - the delete-side
 * counterpart to `insertPropertyPath`, dropping the exact quad `value` was read from rather than
 * adding or swapping one. Does nothing if `value` isn't actually reachable through `path` from
 * `focusNode`. Supports the same path shapes as `insertPropertyPath` - predicate, inverse and
 * sequence - and throws for the same reason on sh:alternativePath, sh:zeroOrMorePath,
 * sh:oneOrMorePath and sh:zeroOrOnePath.
 */
export function removePropertyPath(
  path: PropertyPath,
  focusNode: Quad_Subject,
  dataGraph: RdfStore,
  value: Term,
): void {
  detach(path, focusNode, dataGraph, value, false);
}

function detach(
  path: PropertyPath,
  node: Quad_Subject,
  dataGraph: RdfStore,
  value: Term,
  inverse: boolean,
): void {
  switch (path.type) {
    case "predicate": {
      const existing = inverse
        ? dataGraph.getQuads(asSubject(value), path.predicate, node)[0]
        : dataGraph.getQuads(node, path.predicate, value as Quad_Object)[0];
      if (!existing) return;

      dataGraph.removeQuad(existing);
      return;
    }

    case "sequence": {
      const items = inverse ? [...path.items].reverse() : path.items;
      const last = items.at(-1);
      if (!last) return;

      const start = items
        .slice(0, -1)
        .reduce(
          (current: Quad_Subject | undefined, item) =>
            current && existingIntermediateNode(item, current, dataGraph, inverse),
          node,
        );
      if (!start) return;
      detach(last, start, dataGraph, value, inverse);
      return;
    }

    case "inverse":
      detach(path.path, node, dataGraph, value, !inverse);
      return;

    case "alternative":
    case "zeroOrMore":
    case "oneOrMore":
    case "zeroOrOne":
      throw new Error(
        `Cannot remove a value through a ${path.type} path: it has no single, well-defined place to write to`,
      );
  }
}

// Every non-final step of a sequence must resolve to exactly one node to keep removing through -
// like replacePropertyPath's existingIntermediateNode, this never creates one: if a step isn't
// already reachable then neither is value, so there is nothing to remove.
function existingIntermediateNode(
  item: PropertyPath,
  node: Quad_Subject,
  dataGraph: RdfStore,
  inverse: boolean,
): Quad_Subject | undefined {
  if (item.type === "inverse")
    return existingIntermediateNode(item.path, node, dataGraph, !inverse);
  if (item.type !== "predicate") {
    throw new Error(
      `Cannot remove through a sequence step of type ${item.type}: only predicate steps can be traversed while writing`,
    );
  }

  if (inverse) {
    return dataGraph.getQuads(null, item.predicate, node)[0]?.subject;
  }

  const existing = dataGraph.getQuads(node, item.predicate)[0];
  return existing && asSubject(existing.object);
}

// A term reached by walking through an inverse step must itself be usable as an RDF subject - a
// Literal (or the default graph) cannot be, which for an inverse path means the data or the
// widget-provided value doesn't match what the shape's path actually expects.
function asSubject(term: Term): Quad_Subject {
  if (term.termType === "Literal" || term.termType === "DefaultGraph") {
    throw new Error(`Cannot use a ${term.termType} as an RDF subject: ${term.value}`);
  }
  // Term additionally allows a quoted triple (BaseQuad) here for RDF-star, which property paths
  // never produce or traverse - excluded above, this can only be a NamedNode, BlankNode or Variable.
  return term as Quad_Subject;
}
