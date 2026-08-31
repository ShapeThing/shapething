import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { rdf, sh, xsd } from "@/helpers/namespaces.ts";
import { factory } from "@/helpers/factory.ts";
import { getCodeIdentifier } from "@/helpers/getCodeIdentifier.ts";
import { castDataTypeTermToJs } from "@/helpers/castDataTypeTermToJs.ts";
import { jsValueToTerm } from "@/helpers/jsValueToTerm.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { choiceBranchShapes } from "@/structure/choiceBranches.ts";
import { resolveNodeShapes } from "@/structure/logicalBranches.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export interface JsToRdfOptions {
  shapesGraph: RdfStore;
  // Written into in place and also returned - pass an existing dataGraph to merge `data` into it
  // (e.g. an edit), or omit it to start from an empty store.
  dataGraph?: RdfStore;
  scoresGraph?: RdfStore;
  focusNode: Quad_Subject;
  nodeShapes: Quad_Subject[];
  data: Record<string, unknown>;
  // Required only if `data` actually supplies a value for an rdf:langString property - there's no
  // JS-side signal for which language a plain string is written in, unlike reading (rdf-to-js.ts's
  // `languages` picks among languages already present in the graph).
  contentLanguage?: BCP47;
}

/**
 * The write-side counterpart to rdf-to-js.ts: takes a plain JS object shaped like that module's
 * output (or shaclToType()'s generated type) and writes it into `dataGraph` as RDF, using the same
 * property-key convention (getCodeIdentifier) and the structure layer's own path-aware
 * PropertyUIElement.addObject/replaceObject to do the actual writing - so property paths
 * (sequence/inverse/etc, not just plain predicates) are created correctly for free.
 */
export function jsToRdf(options: JsToRdfOptions): RdfStore {
  const dataGraph = options.dataGraph ?? RdfStore.createDefault();
  const node = new NodeUIElement({
    shapesGraph: options.shapesGraph,
    dataGraph,
    scoresGraph: options.scoresGraph,
    focusNode: options.focusNode,
    nodeShapes: options.nodeShapes,
  });
  writeChildren(node.children(), options.data, options.contentLanguage);
  return dataGraph;
}

function writeChildren(
  children: (PropertyUIElement | ChoiceElement)[],
  data: Record<string, unknown>,
  contentLanguage: BCP47 | undefined,
): void {
  for (const child of children) {
    if (child.kind === "property") {
      writeProperty(child, data, contentLanguage);
    } else {
      writeChoice(child, data, contentLanguage);
    }
  }
}

function writeProperty(
  property: PropertyUIElement,
  data: Record<string, unknown>,
  contentLanguage: BCP47 | undefined,
): void {
  const codeIdentifier = getCodeIdentifier(property.shapesGraph, property.propertyShapes[0]);
  if (!(codeIdentifier in data) || data[codeIdentifier] === undefined) return;
  const rawValue = data[codeIdentifier];

  const memberShapeNodes = property.get(sh("memberShape"));
  if (memberShapeNodes.length > 0) {
    writeMemberShapeProperty(property, memberShapeNodes, rawValue, contentLanguage);
    return;
  }

  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  for (const value of values) {
    property.addObject(jsValueToPropertyTerm(property, value, contentLanguage));
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

// Decides Literal vs NamedNode vs BlankNode from the property SHAPE, never from the JS value's own
// type - the same rule packages/shacl-renderer's dataToRdf.ts follows (there, driven by which kind
// of term the matched widget's createTerm() produces instead), so a value's RDF shape stays
// predictable regardless of what a caller happens to pass:
//  - a plain object embeds as a fresh blank node, written recursively via this property's sh:node.
//  - sh:datatype present -> a literal of that datatype (or the matching alternative, if sh:datatype
//    is a SHACL 1.2 list of alternatives).
//  - otherwise, a string value is a NamedNode (IRI reference) when the shape is resource-shaped
//    (sh:class or sh:node present); anything else falls back to a plain xsd:string literal.
function jsValueToPropertyTerm(
  property: PropertyUIElement,
  value: unknown,
  contentLanguage: BCP47 | undefined,
): Term {
  if (isPlainObject(value)) {
    const nodeShapes = resolveNodeShapes(property);
    const blankNode = factory.blankNode();
    if (nodeShapes.length > 0) {
      const nested = new NodeUIElement({
        shapesGraph: property.shapesGraph,
        dataGraph: property.dataGraph,
        scoresGraph: property.scoresGraph,
        focusNode: blankNode,
        nodeShapes: nodeShapes as Quad_Subject[],
      });
      writeChildren(nested.children(), value, contentLanguage);
    }
    return blankNode;
  }

  const declaredDatatype = property.get(sh("datatype"));
  if (declaredDatatype) {
    const alternatives = expandListOrTerm(declaredDatatype, property.shapesGraph) as NamedNode[];
    const datatype = resolveWriteDatatype(alternatives, value);

    if (datatype.equals(rdf("langString"))) {
      if (!contentLanguage) {
        const codeIdentifier = getCodeIdentifier(property.shapesGraph, property.propertyShapes[0]);
        throw new Error(
          `contentLanguage is required to write "${codeIdentifier}" (rdf:langString)`,
        );
      }
      return jsValueToTerm(value as string, datatype, contentLanguage);
    }

    return jsValueToTerm(value as string | number | boolean | Date, datatype);
  }

  if (typeof value === "string") {
    const isResourceValued =
      (property.get(sh("class")) as Term[]).length > 0 ||
      (property.get(sh("node")) as Term[]).length > 0;
    if (isResourceValued) return factory.namedNode(value);
  }

  return jsValueToTerm(value as string | number | boolean | Date, xsd("string"));
}

// SHACL 1.2 lets sh:datatype hold a list of alternatives (any one of which may hold) rather than a
// single IRI - pick whichever alternative's JS type (per castDataTypeTermToJs) matches the value
// being written, falling back to the first alternative (single-datatype properties are just a
// one-element case of this).
function resolveWriteDatatype(alternatives: NamedNode[], value: unknown): NamedNode {
  if (alternatives.length === 1) return alternatives[0];
  const jsType = value instanceof Date ? "Date" : typeof value;
  return alternatives.find((alternative) => castDataTypeTermToJs(alternative) === jsType) ?? alternatives[0];
}

// The write-side counterpart to rdf-to-js.ts's memberShapeToJs: rebuilds the property's rdf:List
// wholesale from `rawValue` rather than diffing it, mirroring rebuildRdfList's own
// delete-and-rebuild strategy for the list skeleton itself.
function writeMemberShapeProperty(
  property: PropertyUIElement,
  memberShapeNodes: Term[],
  rawValue: unknown,
  contentLanguage: BCP47 | undefined,
): void {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];

  const memberElement = new PropertyUIElement({
    shapesGraph: property.shapesGraph,
    dataGraph: property.dataGraph,
    scoresGraph: property.scoresGraph,
    focusNode: property.focusNode,
    propertyShapes: memberShapeNodes as NamedNode[],
  });

  const memberTerms = values.map((value) => {
    if (isPlainObject(value)) {
      const blankNode = factory.blankNode();
      const nested = new NodeUIElement({
        shapesGraph: property.shapesGraph,
        dataGraph: property.dataGraph,
        scoresGraph: property.scoresGraph,
        focusNode: blankNode,
        nodeShapes: memberShapeNodes as Quad_Subject[],
      });
      writeChildren(nested.children(), value, contentLanguage);
      return blankNode;
    }
    return jsValueToPropertyTerm(memberElement, value, contentLanguage);
  });

  const [existingHead] = property.getObjects();
  const newHead = rebuildRdfList(existingHead ?? rdf("nil"), memberTerms, property.dataGraph);
  if (existingHead) {
    property.replaceObject(existingHead, newHead);
  } else {
    property.addObject(newHead);
  }
}

// A node-level sh:or/sh:xone has no per-instance marker saying which branch was chosen, so - with
// no data written yet to validate against, unlike rdf-to-js.ts's read-side detectActiveChoiceBranch
// - the branch whose own property keys overlap `data` the most is taken to be the intended one.
// Ties keep the first (declaration-order) branch.
function writeChoice(
  choice: ChoiceElement,
  data: Record<string, unknown>,
  contentLanguage: BCP47 | undefined,
): void {
  const branchShapes = choiceBranchShapes(choice);

  let bestChildren: (PropertyUIElement | ChoiceElement)[] | undefined;
  let bestScore = -1;

  for (const branchShape of branchShapes) {
    const children = childrenForShape(
      choice.shapesGraph,
      choice.dataGraph,
      branchShape,
      choice.focusNode,
      choice.scoresGraph,
      choice.widgetRegistry,
    );
    const keys = children
      .filter((child): child is PropertyUIElement => child.kind === "property")
      .map((child) => getCodeIdentifier(child.shapesGraph, child.propertyShapes[0]));
    const score = keys.filter((key) => key in data).length;

    if (score > bestScore) {
      bestScore = score;
      bestChildren = children;
    }
  }

  if (bestChildren) writeChildren(bestChildren, data, contentLanguage);
}
