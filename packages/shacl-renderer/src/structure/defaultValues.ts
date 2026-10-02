import type { Quad, Term } from "@rdfjs/types";
import { diffQuads } from "@/helpers/diffQuads.ts";
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
  const before = node.dataGraph.getQuads();
  for (const child of node.children()) {
    if (!(child instanceof PropertyUIElement)) continue;
    const defaults = child.get(sh("defaultValue")) as Term[];
    if (defaults.length === 0 || child.getObjects().length > 0) continue;
    const path = child.propertyPath();
    if (!path || !(isWritablePath(path) || switchableAlternativeBranches(path))) continue;
    for (const value of defaults) child.addObject(value);
  }
  return diffQuads(before, node.dataGraph.getQuads()).additions;
}
