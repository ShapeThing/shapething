import { RdfStore } from "rdf-stores";
import type { NamedNode } from "@rdfjs/types";
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
  const propertyLines: string[] = [];
  const unionFragments: string[] = [];

  for (const child of node.children()) {
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

  // shaclToType only ever feeds NodeUIElement a node shape as its "focus node" (see
  // shaclToType() above), never real instance data - so despite NodeUIElement.focusNode
  // being typed Quad_Subject (to also support blank-node-rooted forms elsewhere), it's
  // always a NamedNode here.
  const name = getCodeIdentifier(node.shapesGraph, node.focusNode as NamedNode);

  return `export type ${name} = ${fragments.join(" & ")};\n`;
}

function objectType(propertyLines: string[]): string {
  if (propertyLines.length === 0) return "{}";
  return `{\n  ${propertyLines.join("\n  ")}\n}`;
}

function propertyUIElement(property: PropertyUIElement): string {
  const { shapesGraph, propertyShapes } = property;

  const codeIdentifier = getCodeIdentifier(shapesGraph, propertyShapes[0]);
  const minCount = parseFloat(property.getOne(sh("minCount"))?.value ?? "0");
  const maxCount = parseFloat(property.getOne(sh("maxCount"))?.value ?? "Infinity");
  const required = minCount > 0;
  const multiple = maxCount > 1;
  const datatype = resolveDatatype(property);
  const isUnion = datatype.includes(" | ");

  const propertyType: string[] = [codeIdentifier];
  if (!required) propertyType.push("?");
  propertyType.push(": ");
  propertyType.push(multiple && isUnion ? `(${datatype})` : datatype);
  if (multiple) propertyType.push(`[]`);
  propertyType.push(";");
  return propertyType.join("");
}

// sh:datatype normally holds a single IRI, but this renderer also accepts an rdf:List of
// datatypes (any one of which may hold), rendering the union of their distinct JS types.
function resolveDatatype(property: PropertyUIElement): string {
  const declared = property.getOne(sh("datatype")) ?? xsd("string");
  const datatypeTerms = expandListOrTerm(declared, property.shapesGraph);
  const jsTypes = [...new Set(datatypeTerms.map(castDataTypeTermToJs))];
  return jsTypes.join(" | ");
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
    if (element instanceof PropertyUIElement) propertyLines.push(propertyUIElement(element));
    else nestedChoiceFragments.push(choiceElement(element));
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
