import type { Term } from "@rdfjs/types";
import { st } from "@/helpers/namespaces.ts";
import { isUnsetPathNode, parsePathNode } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * st:href on a property shape: its object is a property path (same syntax as sh:path), walked from
 * the property's focus node to find the href its values link to - e.g. `st:href ex:homepage` on
 * the rdfs:label property makes a person's name a link to their homepage. The first value found is
 * the href, an IRI or a literal (a relative URL works too). Undefined when the property has no
 * st:href, or the focus node no value for it.
 */
export function propertyHref(propertyUIElement: PropertyUIElement): string | undefined {
  // keepFirst (constraintResolutions.ts) resolves st:href to a single term, but st() isn't
  // literal-typed, so get()'s PredicateReturn can't know that and falls back to Term[].
  const node = propertyUIElement.get(st("href")) as unknown as Term | undefined;
  if (!node || node.termType === "Literal") return undefined;
  if (isUnsetPathNode(node, propertyUIElement.shapesGraph)) return undefined;
  const path = parsePathNode(node, propertyUIElement.shapesGraph);
  if (!path) return undefined;
  const [href] = walkPropertyPath(path, propertyUIElement.focusNode, propertyUIElement.dataGraph);
  return href && href.termType !== "BlankNode" ? href.value : undefined;
}

/**
 * st:cssClass on a property shape or a property group: class names for its element, so an
 * embedder's stylesheet can lay out a shape by names of its own rather than by the renderer's
 * structure. Each value is one or more class names, separated by spaces.
 */
export function cssClasses(values: readonly Term[]): string | undefined {
  const classes = values
    .filter((value) => value.termType === "Literal")
    .map((value) => value.value);
  return classes.length ? classes.join(" ") : undefined;
}
