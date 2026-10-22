import type { RdfStore } from "rdf-stores";
import type { ValidateResult } from "shacl-engine";
import { sh, shui } from "@/helpers/namespaces.ts";
import { findDynamicInSubjects } from "@/structure/dynamicIn.ts";

const SERVICE = /\bSERVICE\b/i;

/**
 * Every property shape (by IRI/blank node id) whose values come from a remote endpoint - a
 * shui:searchQuery or dynamic `sh:in [ sh:select ]` that reaches out via SERVICE. Such a value
 * (e.g. a DBpedia philosopher, a TOOI concept) is described on that endpoint, not in the local
 * dataGraph, so value-node constraints that inspect its own triples (sh:class, sh:node) can never
 * pass locally - see withoutUncheckableRemoteValueResults.
 */
export function federatedPropertyShapes(shapesGraph: RdfStore): Set<string> {
  const shapes = new Set<string>();

  for (const quad of shapesGraph.getQuads(null, shui("searchQuery"))) {
    if (quad.object.termType === "Literal" && SERVICE.test(quad.object.value)) {
      shapes.add(quad.subject.value);
    }
  }

  for (const subject of findDynamicInSubjects(shapesGraph)) {
    const list = shapesGraph.getQuads(subject, sh("in"))[0].object;
    const select = shapesGraph.getQuads(list, sh("select"))[0].object;
    if (SERVICE.test(select.value)) shapes.add(subject.value);
  }

  return shapes;
}

// Value-node constraints that inspect the value's own triples.
const VALUE_DESCRIPTION_COMPONENTS = [
  sh("ClassConstraintComponent"),
  sh("NodeConstraintComponent"),
];

/**
 * `results` minus the sh:class/sh:node results on a federated property's (see
 * federatedPropertyShapes) values that aren't described in `dataGraph` at all - such a value lives
 * on its remote endpoint, so those constraints would fail on it no matter what it is. A value whose
 * triples were copied into dataGraph is still validated as usual, and membership itself is still
 * checked against the endpoint by validateDynamicInProperties.
 */
export function withoutUncheckableRemoteValueResults(
  results: ValidateResult[],
  federatedShapes: Set<string>,
  dataGraph: RdfStore,
): ValidateResult[] {
  return results.filter((result) => {
    const value = result.value?.term;
    return !(
      value?.termType === "NamedNode" &&
      federatedShapes.has(result.shape.ptr.term.value) &&
      VALUE_DESCRIPTION_COMPONENTS.some((component) =>
        result.constraintComponent?.equals(component),
      ) &&
      dataGraph.getQuads(value).length === 0
    );
  });
}
