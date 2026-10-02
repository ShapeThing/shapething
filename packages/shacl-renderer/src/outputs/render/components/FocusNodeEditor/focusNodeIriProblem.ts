import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { sh } from "@/helpers/namespaces.ts";

export type FocusNodeIriProblem = "invalid" | "in-use" | "pattern";

// An absolute IRI: a scheme, then no whitespace or characters RFC 3987 excludes outright.
const ABSOLUTE_IRI = /^[a-z][a-z0-9+.-]*:[^\s<>"{}|\\^`]+$/i;

/**
 * Why `iri` can't become the focus node's new identifier - or undefined when it can. Besides not
 * being an absolute IRI at all, it mustn't already identify a different resource in `dataGraph`
 * (renaming onto it would silently merge the two), and it has to satisfy any sh:pattern the node
 * shapes put on the focus node itself - SHACL applies a node shape's sh:pattern to the focus
 * node's own IRI.
 */
export function focusNodeIriProblem(
  iri: string,
  {
    current,
    dataGraph,
    shapesGraph,
    nodeShapes,
  }: { current: Term; dataGraph: RdfStore; shapesGraph: RdfStore; nodeShapes: Quad_Subject[] },
): FocusNodeIriProblem | undefined {
  if (!ABSOLUTE_IRI.test(iri)) return "invalid";
  if (iri === current.value) return undefined;
  if (dataGraph.getQuads(factory.namedNode(iri), null, null).length > 0) return "in-use";
  for (const shape of nodeShapes) {
    const flags = shapesGraph.getQuads(shape, sh("flags"))[0]?.object.value;
    for (const { object: pattern } of shapesGraph.getQuads(shape, sh("pattern"))) {
      try {
        if (!new RegExp(pattern.value, flags).test(iri)) return "pattern";
      } catch {
        // An invalid pattern is the shape's problem, not this IRI's - validation reports it.
      }
    }
  }
  return undefined;
}
