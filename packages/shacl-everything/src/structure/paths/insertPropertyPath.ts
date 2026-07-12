import type { Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

/**
 * Writes `value` as a new value for `path` starting at `focusNode` into `dataGraph` - the
 * write-side counterpart to `walkPropertyPath`. Only path shapes with one well-defined place to
 * attach a new triple are supported: predicate, inverse and sequence paths (creating - or reusing,
 * if one is already reachable, so repeated inserts share it rather than forking - a blank node for
 * every intermediate step of a sequence). sh:alternativePath, sh:zeroOrMorePath, sh:oneOrMorePath
 * and sh:zeroOrOnePath have no single such place (an alternative has several equally valid
 * branches; the repeatable paths have no fixed length) and throw instead.
 */
export function insertPropertyPath(
  path: PropertyPath,
  focusNode: Quad_Subject,
  dataGraph: RdfStore,
  value: Term,
): void {
  attach(path, focusNode, dataGraph, value, false);
}

function attach(
  path: PropertyPath,
  node: Quad_Subject,
  dataGraph: RdfStore,
  value: Term,
  inverse: boolean,
): void {
  switch (path.type) {
    case "predicate":
      dataGraph.addQuad(
        inverse
          ? factory.quad(asSubject(value), path.predicate, node)
          : factory.quad(node, path.predicate, value as Quad_Object),
      );
      return;

    case "sequence": {
      const items = inverse ? [...path.items].reverse() : path.items;
      const last = items.at(-1);
      if (!last) return;

      const start = items
        .slice(0, -1)
        .reduce((current, item) => intermediateNode(item, current, dataGraph, inverse), node);
      attach(last, start, dataGraph, value, inverse);
      return;
    }

    case "inverse":
      attach(path.path, node, dataGraph, value, !inverse);
      return;

    case "alternative":
    case "zeroOrMore":
    case "oneOrMore":
    case "zeroOrOne":
      throw new Error(
        `Cannot insert a value through a ${path.type} path: it has no single, well-defined place to write to`,
      );
  }
}

// Every non-final step of a sequence must itself resolve to exactly one node to keep writing
// through. Reuses the node already reachable by walking one step from `node`, if there is one, so
// that a second insert through the same intermediate (e.g. a shared address blank node) attaches
// to it rather than creating a sibling; otherwise creates a fresh blank node linked in by this
// step's own predicate.
function intermediateNode(
  item: PropertyPath,
  node: Quad_Subject,
  dataGraph: RdfStore,
  inverse: boolean,
): Quad_Subject {
  if (item.type === "inverse") return intermediateNode(item.path, node, dataGraph, !inverse);
  if (item.type !== "predicate") {
    throw new Error(
      `Cannot insert through a sequence step of type ${item.type}: only predicate steps can be traversed while writing`,
    );
  }

  if (inverse) {
    const existing = dataGraph.getQuads(null, item.predicate, node);
    if (existing.length > 0) return existing[0].subject;

    const fresh = factory.blankNode();
    dataGraph.addQuad(factory.quad(fresh, item.predicate, node));
    return fresh;
  }

  const existing = dataGraph.getQuads(node, item.predicate);
  if (existing.length > 0) return asSubject(existing[0].object);

  const fresh = factory.blankNode();
  dataGraph.addQuad(factory.quad(node, item.predicate, fresh));
  return fresh;
}

// A term reached by walking or about to be written through an inverse step must itself be usable
// as an RDF subject - a Literal (or the default graph) cannot be, which for an inverse path means
// the data or the widget-provided value doesn't match what the shape's path actually expects.
function asSubject(term: Term): Quad_Subject {
  if (term.termType === "Literal" || term.termType === "DefaultGraph") {
    throw new Error(`Cannot use a ${term.termType} as an RDF subject: ${term.value}`);
  }
  // Term additionally allows a quoted triple (BaseQuad) here for RDF-star, which property paths
  // never produce or traverse - excluded above, this can only be a NamedNode, BlankNode or Variable.
  return term as Quad_Subject;
}
