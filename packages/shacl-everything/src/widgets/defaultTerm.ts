import type { NamedNode, Term } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { sh, xsd } from "@/helpers/namespaces.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { getWidgetMeta } from "@/widgets/registry.ts";
import type { CreateTermContext } from "@/widgets/types.ts";

/**
 * The empty term a property's value should start as, for widgets whose meta.ts declares no
 * createTerm - derived from what the property shape already states: sh:datatype for literals,
 * sh:nodeKind for an unambiguous IRI/blank node, sh:class as a last-resort signal that the
 * value is a resource reference. Falls back to a plain xsd:string literal when the shape says
 * nothing at all.
 */
export function defaultTermFromShape(shape: PropertyUIElement): Term {
  const datatype = shape.getOne(sh("datatype"));
  if (datatype) return factory.literal("", datatype as NamedNode);

  const nodeKinds = shape.get(sh("nodeKind"));
  if (nodeKinds.length === 1 && nodeKinds[0].equals(sh("IRI"))) return factory.namedNode("");
  if (nodeKinds.length === 1 && nodeKinds[0].equals(sh("BlankNode"))) return factory.blankNode();

  if (shape.get(sh("class")).length > 0) return factory.namedNode("");

  return factory.literal("", xsd("string"));
}

/**
 * The empty term to use for a new value of the given widget, preferring its own createTerm
 * (when its meta.ts declares one) over the generic shape-derived default.
 */
export function createDefaultTerm(
  widget: NamedNode,
  shape: PropertyUIElement,
  context: CreateTermContext,
): Term {
  const createTerm = getWidgetMeta(widget)?.createTerm;
  return createTerm ? createTerm(context, shape) : defaultTermFromShape(shape);
}
