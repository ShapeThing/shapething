import type { Quad, Term } from "@rdfjs/types";
import { snapshotStore } from "@/helpers/snapshotStore.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { isWritablePath } from "@/structure/orderByValues.ts";
import { switchableAlternativeBranches } from "@/structure/paths/alternativePathBranches.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * Writes every sh:defaultValue of `node`'s properties into its dataGraph, as the starting values
 * of a resource that's only just being created - SHACL's "pre-populate input widgets" reading of
 * sh:defaultValue, done by actually writing the values rather than only prefilling an input, so
 * what the form shows is exactly what gets submitted (an untouched prefilled input would otherwise
 * look filled in but never be saved).
 *
 * Only properties with no value yet, and only paths a value can be written through (see
 * PropertyUIElement.addObject), are seeded. A property inside a sh:or/sh:xone choice isn't - no
 * branch has been picked yet to seed it into. Returns the quads it added, so a caller can tell the
 * seeded state apart from a real edit (see EditModeWrapper's Create/Update button).
 *
 * Existing resources are never seeded: a default is where a *new* value starts, not a claim about
 * data that simply doesn't state the property.
 */
export function seedDefaultValues(node: NodeUIElement): Quad[] {
  const toSeed: { child: PropertyUIElement; defaults: Term[] }[] = [];
  for (const child of node.children()) {
    if (!(child instanceof PropertyUIElement)) continue;
    const defaults = child.get(sh("defaultValue")) as Term[];
    if (defaults.length === 0 || child.getObjects().length > 0) continue;
    const path = child.propertyPath();
    if (!path || !(isWritablePath(path) || switchableAlternativeBranches(path))) continue;
    toSeed.push({ child, defaults });
  }
  // Nothing to seed (the usual case): no snapshot of the dataGraph needed at all.
  if (toSeed.length === 0) return [];

  // What addObject writes isn't one quad per value (an rdf:List, an alternative path's branch,
  // ...), so the additions are found by comparing against a snapshot - one sharing the store's
  // term dictionary, so it costs id tuples only.
  const before = snapshotStore(node.dataGraph);
  for (const { child, defaults } of toSeed) for (const value of defaults) child.addObject(value);
  return node.dataGraph
    .getQuads()
    .filter(
      (quad) => before.countQuads(quad.subject, quad.predicate, quad.object, quad.graph) === 0,
    );
}
