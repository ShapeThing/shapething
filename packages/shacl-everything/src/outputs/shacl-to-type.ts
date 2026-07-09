import { RdfStore } from "rdf-stores";
import type { NamedNode, Term } from "@rdfjs/types";
import { rdf, sh, xsd } from "../helpers/namespaces.ts";
import { getCodeIdentifier } from "../helpers/getCodeIdentifier.ts";
import { NodeUIElement } from "../structure/NodeUIElement.ts";
import { PropertyUIElement } from "../structure/PropertyUIElement.ts";
import { ChoiceElement } from "../structure/ChoiceElement.ts";
import { castDataTypeTermToJs } from "../helpers/castDataTypeTermToJs.ts";
import { format } from "prettier";
import * as parserTypeScript from "prettier/parser-typescript";
import prettierPluginEstree from "prettier/plugins/estree";

export const commonPrettierOptions = {
  semi: true,
  singleQuote: true,
  printWidth: 10,
  tabWidth: 2,
  useTabs: false,
  trailingComma: "es5",
} as const;

export interface TypeOptions {
  shapesGraph: RdfStore;
  nodeShapes?: NamedNode[];
}

export async function shaclToType(options: TypeOptions): Promise<Map<string, string>> {
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

    const typeString = nodeUIElement(node);
    const formattedGeneratedCode = await format(typeString, {
      parser: "typescript",
      plugins: [parserTypeScript, prettierPluginEstree],
      ...commonPrettierOptions,
      printWidth: 80,
    });
    types.set(codeIdentifier, formattedGeneratedCode);
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
    fragments.push(`{\n  ${propertyLines.join("\n  ")}\n}`);
  }
  fragments.push(...unionFragments);

  const name = getCodeIdentifier(node.shapesGraph, node.focusNode);

  return `export type ${name} = ${fragments.join(" & ")};`;
}

const getterFactory = (shapesGraph: RdfStore, subject: NamedNode) => (predicate: NamedNode) => {
  return shapesGraph.getQuads(subject, predicate)[0]?.object as Term | undefined;
};

function propertyUIElement(property: PropertyUIElement): string {
  const { shapesGraph, propertyShape } = property;
  const get = getterFactory(shapesGraph, propertyShape);

  const codeIdentifier = getCodeIdentifier(shapesGraph, propertyShape);
  const minCount = parseFloat(get(sh("minCount"))?.value ?? "0");
  const maxCount = parseFloat(get(sh("maxCount"))?.value ?? "Infinity");
  const required = minCount > 0;
  const multiple = maxCount > 1;
  const datatype = castDataTypeTermToJs(get(sh("datatype")) ?? xsd("string"));

  const propertyType: string[] = [codeIdentifier];
  if (!required) propertyType.push("?");
  propertyType.push(": ");
  propertyType.push(datatype);
  if (multiple) propertyType.push(`[]`);
  propertyType.push(";");
  return propertyType.join("");
}

// sh:or is an inclusive union: any one (or more) of the branches may hold.
function choiceElement(choice: ChoiceElement): string {
  const branches = choice.children();

  return choice.connective === "xone"
    ? xoneUnion(branches)
    : `(${branches.map((properties) => branchObjectType(properties)).join(" | ")})`;
}

function branchObjectType(properties: PropertyUIElement[], extraLines: string[] = []): string {
  const lines = [...properties.map(propertyUIElement), ...extraLines];
  return `{ ${lines.join(" ")} }`;
}

// sh:xone allows exactly one branch. Each branch marks every other branch's
// keys as `never`, so an object satisfying more than one branch at once -
// whether a fresh literal or a value coming from a typed variable - is
// rejected: a property typed `never` is a genuine structural mismatch, not
// merely an excess-property warning that literals can dodge.
function xoneUnion(branches: PropertyUIElement[][]): string {
  const branchKeys = branches.map((properties) =>
    properties.map((property) => getCodeIdentifier(property.shapesGraph, property.propertyShape)),
  );
  const allKeys = [...new Set(branchKeys.flat())];

  const rendered = branches.map((properties, index) => {
    const ownKeys = new Set(branchKeys[index]);
    const foreignKeys = allKeys.filter((key) => !ownKeys.has(key));
    return branchObjectType(
      properties,
      foreignKeys.map((key) => `${key}?: never;`),
    );
  });

  return `(${rendered.join(" | ")})`;
}
