import { RdfStore } from "rdf-stores";
import type { NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import { rdf, sh, xsd } from "@/helpers/namespaces.ts";
import { getCodeIdentifier } from "@/helpers/getCodeIdentifier.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { castDataTypeTermToJs } from "@/helpers/castDataTypeTermToJs.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";

export interface TypeOptions {
  shapesGraph: RdfStore;
  nodeShapes?: NamedNode[];
}

export function shaclToType(options: TypeOptions): Map<string, string> {
  const types = new Map<string, string>();
  const { shapesGraph } = options;

  if (!options.nodeShapes) {
    options.nodeShapes = shapesGraph
      .getQuads(null, rdf("type"), sh("NodeShape"))
      .map((quad) => quad.subject as NamedNode);
  }

  for (const nodeShape of options.nodeShapes) {
    const codeIdentifier = getCodeIdentifier(shapesGraph, nodeShape);

    const node = new NodeUIElement({
      shapesGraph: options.shapesGraph,
      dataGraph: RdfStore.createDefault(),
      focusNode: nodeShape,
      nodeShapes: [nodeShape],
    });

    types.set(codeIdentifier, nodeUIElement(node));
  }

  return types;
}

function nodeUIElement(node: NodeUIElement): string {
  // shaclToType only ever feeds NodeUIElement a node shape as its "focus node" (see
  // shaclToType() above), never real instance data - so despite NodeUIElement.focusNode
  // being typed Quad_Subject (to also support blank-node-rooted forms elsewhere), it's
  // always a NamedNode here.
  const name = getCodeIdentifier(node.shapesGraph, node.focusNode as NamedNode);

  return `export type ${name} = ${childrenType(node.children())};\n`;
}

// The object-type-intersected-with-union-fragments expression nodeUIElement() exports under a
// type name - factored out so resolveMemberType (a sh:memberShape's own children, see below) can
// produce the identical shape inline and unnamed.
function childrenType(children: (PropertyUIElement | ChoiceElement)[]): string {
  const propertyLines: string[] = [];
  const unionFragments: string[] = [];

  for (const child of children) {
    if (child instanceof PropertyUIElement) {
      propertyLines.push(propertyUIElement(child));
    } else if (child instanceof ChoiceElement) {
      unionFragments.push(choiceElement(child));
    }
  }

  const fragments: string[] = [];
  if (propertyLines.length > 0 || unionFragments.length === 0) {
    fragments.push(objectType(propertyLines));
  }

  // A union only needs parens when it's intersected with something else via
  // `&`; standing alone, its `|` members already bind correctly.
  const needsParens = fragments.length > 0 || unionFragments.length > 1;
  fragments.push(...unionFragments.map((union) => (needsParens ? `(${union})` : union)));

  return fragments.join(" & ");
}

function objectType(propertyLines: string[]): string {
  if (propertyLines.length === 0) return "{}";
  return `{\n  ${propertyLines.join("\n  ")}\n}`;
}

function propertyUIElement(property: PropertyUIElement): string {
  const { shapesGraph, propertyShapes } = property;

  const codeIdentifier = getCodeIdentifier(shapesGraph, propertyShapes[0]);

  // sh:memberShape constrains each item of this property's rdf:List value (see
  // MemberShapeList.tsx), not the property's value directly - its presence changes both what
  // "the type" even means (every member's type, not the property's own) and which constraint
  // governs required-ness (sh:minListLength, not sh:minCount).
  const memberShapeNodes = property.get(sh("memberShape"));
  if (memberShapeNodes.length > 0) {
    return memberShapeProperty(property, codeIdentifier, memberShapeNodes);
  }

  const minCount = property.get(sh("minCount")) ?? 0;
  const maxCount = property.get(sh("maxCount")) ?? Infinity;
  const required = minCount > 0;
  const multiple = maxCount > 1;
  const datatype = resolveType(property);
  // Only a bare object literal binds tightly enough to precede `[]` unparenthesized (mirrors
  // memberShapeProperty's own isPureObject/needsParens below) - a scalar datatype union or a
  // sh:node'd object intersected with its own nested sh:or (via resolveType's childrenType call)
  // does not.
  const isPureObject = datatype.startsWith("{") && datatype.endsWith("}");
  const needsParens = !isPureObject && (datatype.includes(" | ") || datatype.includes(" & "));

  const propertyType: string[] = [codeIdentifier];
  if (!required) propertyType.push("?");
  propertyType.push(": ");
  propertyType.push(multiple && needsParens ? `(${datatype})` : datatype);
  if (multiple) propertyType.push(`[]`);
  propertyType.push(";");
  return propertyType.join("");
}

// sh:node embeds another node shape's own object type directly, the same way generate.ts/
// jsToRdf/rdfToJs all treat a sh:node-declared property's value as a nested object rather than a
// scalar - resolveDatatype's sh:datatype-based resolution only kicks in once sh:node is absent.
function resolveType(property: PropertyUIElement): string {
  const nodeShapes = property.get(sh("node")) as Term[];
  if (nodeShapes.length === 0) return resolveDatatype(property);

  const node = new NodeUIElement({
    shapesGraph: property.shapesGraph,
    dataGraph: RdfStore.createDefault(),
    focusNode: property.focusNode,
    nodeShapes: nodeShapes as Quad_Subject[],
  });
  return childrenType(node.children());
}

// sh:datatype normally holds a single IRI, but this renderer also accepts an rdf:List of
// datatypes (any one of which may hold), rendering the union of their distinct JS types.
function resolveDatatype(property: PropertyUIElement): string {
  const declared = property.get(sh("datatype")) ?? xsd("string");
  const datatypeTerms = expandListOrTerm(declared, property.shapesGraph);
  const jsTypes = [...new Set(datatypeTerms.map(castDataTypeTermToJs))];
  return jsTypes.join(" | ");
}

// sh:memberShape's type is always an array - the property itself holds a single rdf:List, but
// that's a plumbing detail this codegen collapses away the same way it already hides ordinary
// multi-value properties being separate triples. sh:minListLength (not sh:minCount, which here
// only ever governs whether the list itself is present) decides required-ness.
function memberShapeProperty(
  property: PropertyUIElement,
  codeIdentifier: string,
  memberShapeNodes: Term[],
): string {
  const required = (property.get(sh("minListLength")) ?? 0) > 0;
  const memberType = resolveMemberType(property, memberShapeNodes);

  // Only a bare object literal binds tightly enough to precede `[]` unparenthesized; a scalar
  // union or a member type intersected with a nested choice (via resolveMemberType's own
  // childrenType call) does not.
  const isPureObject = memberType.startsWith("{") && memberType.endsWith("}");
  const needsParens = !isPureObject && (memberType.includes(" | ") || memberType.includes(" & "));

  const propertyType: string[] = [codeIdentifier];
  if (!required) propertyType.push("?");
  propertyType.push(": ");
  propertyType.push(needsParens ? `(${memberType})` : memberType);
  propertyType.push("[];");
  return propertyType.join("");
}

// A memberShape is itself a full shape: it may declare sh:property/sh:node - an object-shaped
// member, same as any node shape (e.g. spec 7.5.1.c's steps-with-instruction/duration) - or
// nothing but sh:datatype/facets - a scalar member (e.g. 7.5.1.a's 0-100 integer scores).
// childrenForShape (via NodeUIElement) already knows how to expand the former; finding no
// children is the signal to fall back to ordinary sh:datatype resolution instead, over a
// synthetic PropertyUIElement standing in for the memberShape node(s) - mirroring
// MemberShapeList.tsx's own `memberElement`.
function resolveMemberType(property: PropertyUIElement, memberShapeNodes: Term[]): string {
  const { shapesGraph, focusNode } = property;
  const dataGraph = RdfStore.createDefault();

  const node = new NodeUIElement({
    shapesGraph,
    dataGraph,
    focusNode,
    nodeShapes: memberShapeNodes as Quad_Subject[],
  });
  const children = node.children();
  if (children.length > 0) return childrenType(children);

  const memberElement = new PropertyUIElement({
    shapesGraph,
    dataGraph,
    focusNode,
    propertyShapes: memberShapeNodes as NamedNode[],
  });
  return resolveDatatype(memberElement);
}

// sh:or is an inclusive union: any one (or more) of the branches may hold.
function choiceElement(choice: ChoiceElement): string {
  const branches = choice.children();

  return choice.connective === "xone"
    ? xoneUnion(branches)
    : branches.map((elements) => branchObjectType(elements)).join(" | ");
}

function branchObjectType(
  elements: (PropertyUIElement | ChoiceElement)[],
  extraLines: string[] = [],
): string {
  const propertyLines: string[] = [];
  const nestedChoiceFragments: string[] = [];
  for (const element of elements) {
    if (element instanceof PropertyUIElement) {
      propertyLines.push(propertyUIElement(element));
    } else nestedChoiceFragments.push(choiceElement(element));
  }

  const base = `{ ${[...propertyLines, ...extraLines].join(" ").replace(/;$/, "")} }`;
  if (nestedChoiceFragments.length === 0) return base;

  // A branch nesting a further sh:or/xone (via sh:node) must satisfy its own properties *and*
  // one of the nested choice's branches - mirrors nodeUIElement()'s own `&`-combination of its
  // object type with a union fragment. Parens are always required here (unlike
  // nodeUIElement()'s conditional needsParens), since `base` is always present as a sibling.
  return [base, ...nestedChoiceFragments.map((fragment) => `(${fragment})`)].join(" & ");
}

// sh:xone allows exactly one branch. Each branch marks every other branch's
// keys as `never`, so an object satisfying more than one branch at once -
// whether a fresh literal or a value coming from a typed variable - is
// rejected: a property typed `never` is a genuine structural mismatch, not
// merely an excess-property warning that literals can dodge.
//
// TODO a branch nesting a further sh:or/xone (via sh:node) only contributes its own direct
// sh:property keys to this exclusivity check - properties reachable through the nested choice
// aren't accounted for. Full transitive exclusivity through arbitrary nesting depth is out of
// scope for what is a type-generation convenience; shacl-engine remains the actual runtime
// source of truth for conformance.
function xoneUnion(branches: (PropertyUIElement | ChoiceElement)[][]): string {
  const branchKeys = branches.map((elements) =>
    elements
      .filter((element): element is PropertyUIElement => element instanceof PropertyUIElement)
      .map((property) => getCodeIdentifier(property.shapesGraph, property.propertyShapes[0])),
  );
  const allKeys = [...new Set(branchKeys.flat())];

  const rendered = branches.map((elements, index) => {
    const ownKeys = new Set(branchKeys[index]);
    const foreignKeys = allKeys.filter((key) => !ownKeys.has(key));
    return branchObjectType(
      elements,
      foreignKeys.map((key) => `${key}?: never;`),
    );
  });

  return rendered.join(" | ");
}
