import { factory } from "@/helpers/factory.ts";
import { rdfs, sh, shui } from "@/helpers/namespaces.ts";
import language from "@/resolution/language.ts";
import { parsePropertyPath, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Literal, NamedNode, Term } from "@rdfjs/types";

type PropertyLabelOptions = { widget: Term; propertyShape: PropertyUIElement };

export function propertyLabel({ widget, propertyShape }: PropertyLabelOptions) {
  const { scoresGraph, shapesGraph } = propertyShape;

  const labelQuadViaShapes = language(
    shapesGraph.getQuads(widget, rdfs("label")).map(({ object }) => object as Literal),
  );
  if (labelQuadViaShapes) {
    return labelQuadViaShapes.value;
  }

  const labelQuadViaScores = language(
    scoresGraph.getQuads(widget, rdfs("label")).map(({ object }) => object as Literal),
  );
  if (labelQuadViaScores) {
    return labelQuadViaScores.value;
  }

  return widget.value.split(/\/|#/g).pop()!;
}

type ValueNodeLabelOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
};

// The property paths (sh:path) of every property shape on `propertyShape`'s sh:node that's
// annotated shui:propertyRole `role` - shared by labelRolePropertyPaths and
// depictionRolePropertyPaths, which only differ in which role they look for.
function propertyPathsByRole(propertyShape: PropertyUIElement, role: NamedNode): PropertyPath[] {
  const { shapesGraph } = propertyShape;
  const node = propertyShape.getOne(sh("node"));

  return shapesGraph
    .getQuads(node, sh("property"))
    .filter(
      ({ object: property }) =>
        shapesGraph.getQuads(property, shui("propertyRole"), role).length > 0,
    )
    .map(({ object: property }) => parsePropertyPath(property, shapesGraph))
    .filter((path): path is PropertyPath => path !== null);
}

/**
 * The property paths (sh:path) of every property shape on `propertyShape`'s sh:node that's
 * annotated shui:propertyRole shui:LabelRole - i.e. what to walk from a value node to find its
 * display label. Shared by valueNodeLabel (walks the path per value) and anything that instead
 * needs the path itself, e.g. to build a SPARQL query (see structure/paths/toSparql.ts).
 */
export function labelRolePropertyPaths(propertyShape: PropertyUIElement): PropertyPath[] {
  return propertyPathsByRole(propertyShape, shui("LabelRole"));
}

/**
 * The property paths (sh:path) of every property shape on `propertyShape`'s sh:node that's
 * annotated shui:propertyRole shui:DepictionRole - i.e. what to walk from a value node to find an
 * image representing it. Mirrors labelRolePropertyPaths.
 */
export function depictionRolePropertyPaths(propertyShape: PropertyUIElement): PropertyPath[] {
  return propertyPathsByRole(propertyShape, shui("DepictionRole"));
}

/**
 * The property paths (sh:path) of every property shape on `propertyShape`'s sh:node that's
 * annotated shui:propertyRole shui:SubLabelRole - secondary, disambiguating text shown alongside
 * the main LabelRole label (e.g. a pseudonym next to a person's name). Mirrors labelRolePropertyPaths.
 */
export function subLabelRolePropertyPaths(propertyShape: PropertyUIElement): PropertyPath[] {
  return propertyPathsByRole(propertyShape, shui("SubLabelRole"));
}

// 8.2.2 Value Node Labels
export function valueNodeLabel({ term, propertyShape }: ValueNodeLabelOptions): Literal {
  const { dataGraph } = propertyShape;

  //  1. If V is a literal, use its lexical form as the label.
  if (term.termType === "Literal") {
    return term;
  }

  // 2. If the applicable node shape for V contains a property shape whose sh:path is annotated with shui:propertyRole shui:LabelRole,
  // retrieve the values of that path from the data graph for subject V. Select the best matching value using language resolution.
  // If a match is found, use that literal as the label.
  const labelsViaPropertyRoles = labelRolePropertyPaths(propertyShape)
    .flatMap((path) => walkPropertyPath(path, term, dataGraph))
    .filter((value): value is Literal => value.termType === "Literal");

  if (labelsViaPropertyRoles.length > 0) {
    return language(labelsViaPropertyRoles);
  }

  // 3. If V is an IRI, try to find its rdfs:label in the data graph. If found, use that literal as the label.
  if (term.termType === "NamedNode") {
    const labelQuads = dataGraph.getQuads(term, rdfs("label"));
    if (labelQuads.length > 0) {
      return language(labelQuads.map(({ object }) => object as Literal));
    }
  }

  return factory.literal(term.value);
}

type ValueNodeSubLabelOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
};

/**
 * Secondary, disambiguating text for V: the best-language literal from a shui:SubLabelRole-
 * annotated path from V in the data graph (e.g. a pseudonym alongside a person's name). Unlike
 * valueNodeLabel there is no rdfs:label or lexical-value fallback - a value simply has no sub-label
 * when nothing matches.
 */
export function valueNodeSubLabel({
  term,
  propertyShape,
}: ValueNodeSubLabelOptions): Literal | undefined {
  if (term.termType === "Literal") return undefined;

  const { dataGraph } = propertyShape;
  const subLabels = subLabelRolePropertyPaths(propertyShape)
    .flatMap((path) => walkPropertyPath(path, term, dataGraph))
    .filter((value): value is Literal => value.termType === "Literal");

  return subLabels.length > 0 ? language(subLabels) : undefined;
}

type ValueNodeDepictionOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
};

/**
 * An image representing V: the first value of a shui:DepictionRole-annotated path from V in the
 * data graph, e.g. foaf:depiction. Undefined when V is a literal (nothing to walk from) or no such
 * value exists.
 */
export function valueNodeDepiction({
  term,
  propertyShape,
}: ValueNodeDepictionOptions): NamedNode | undefined {
  if (term.termType === "Literal") return undefined;

  const { dataGraph } = propertyShape;

  return depictionRolePropertyPaths(propertyShape)
    .flatMap((path) => walkPropertyPath(path, term, dataGraph))
    .find((value): value is NamedNode => value.termType === "NamedNode");
}
