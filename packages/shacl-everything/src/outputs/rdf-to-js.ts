import type { Literal, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { getCodeIdentifier } from "@/helpers/getCodeIdentifier.ts";
import { termToJsValue } from "@/helpers/termToJsValue.ts";
import { getRdfList } from "@/helpers/rdfList.ts";
import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { NodeUIElement } from "@/structure/NodeUIElement.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { childrenForShape } from "@/structure/childrenForShape.ts";
import { choiceBranchShapes, detectActiveChoiceBranch } from "@/structure/choiceBranches.ts";
import type { LanguageRange } from "@/types/BCP47.ts";

export interface RdfToJsOptions {
  shapesGraph: RdfStore;
  dataGraph: RdfStore;
  scoresGraph?: RdfStore;
  focusNode: Quad_Subject;
  nodeShapes: Quad_Subject[];
  // Ranked language preference used to collapse a multi-translation rdf:langString property down
  // to the one JS string shaclToType.ts's generated type expects - same resolution bestByLanguage
  // already gives PropertyUIElement.get()'s own languages overload. Omit to fall back to
  // bestByLanguage's own languages-empty behavior: the first language-less value, or else
  // whichever value happens to be first.
  languages?: LanguageRange[];
}

/**
 * Reads `focusNode` out of `dataGraph` into a plain JS object shaped like shaclToType()'s
 * generated type for the same node shape(s) - same property-key naming (getCodeIdentifier), same
 * sh:memberShape-list-as-array and sh:or/sh:xone-as-merged-branch handling, so a value this
 * produces is assignable to that generated type without adapting it by hand.
 */
export async function rdfToJs(options: RdfToJsOptions): Promise<Record<string, unknown>> {
  const node = new NodeUIElement(options);
  return childrenToJs(node.children(), options.languages ?? []);
}

async function childrenToJs(
  children: (PropertyUIElement | ChoiceElement)[],
  languages: LanguageRange[],
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  for (const child of children) {
    if (child.kind === "property") {
      Object.assign(result, await propertyToJs(child, languages));
    } else {
      Object.assign(result, await choiceToJs(child, languages));
    }
  }

  return result;
}

async function propertyToJs(
  property: PropertyUIElement,
  languages: LanguageRange[],
): Promise<Record<string, unknown>> {
  const codeIdentifier = getCodeIdentifier(property.shapesGraph, property.propertyShapes[0]);

  const memberShapeNodes = property.get(sh("memberShape"));
  if (memberShapeNodes.length > 0) {
    return { [codeIdentifier]: await memberShapeToJs(property, memberShapeNodes, languages) };
  }

  const terms = property.getObjects();
  if (terms.length === 0) return {};

  // A langString-typed property always collapses to a single JS string, regardless of sh:maxCount
  // or how many translations actually exist - matching shaclToType.ts, which likewise never types
  // a langString property as an array (see its resolveDatatype). bestByLanguage's own
  // languages-empty fallback (first language-less value, else the first value) keeps this
  // deterministic even with no `languages` option given.
  const declaredDatatype = property.get(sh("datatype"));
  if (declaredDatatype?.termType === "NamedNode" && declaredDatatype.equals(rdf("langString"))) {
    const best = bestByLanguage(terms, languages);
    return best ? { [codeIdentifier]: termToJsValue(best as Literal) } : {};
  }

  const multiple = (property.get(sh("maxCount")) ?? Infinity) > 1;
  const values = await Promise.all(terms.map((term) => termToJs(term, property, languages)));
  return { [codeIdentifier]: multiple ? values : values[0] };
}

// A property's actual value term - Literal (coerced via termToJsValue), NamedNode (its IRI, as a
// plain string - never expanded into a nested object, so a reference to another resource can't
// recurse into a cycle), or BlankNode (recursed into a nested object, via this property's own
// sh:node - the shape describing what such a nested value looks like).
async function termToJs(
  term: Term,
  property: PropertyUIElement,
  languages: LanguageRange[],
): Promise<unknown> {
  if (term.termType === "Literal") return termToJsValue(term);
  if (term.termType === "NamedNode") return term.value;

  const nodeShapes = property.get(sh("node")) as Term[];
  if (nodeShapes.length === 0) return {};

  const nested = new NodeUIElement({
    shapesGraph: property.shapesGraph,
    dataGraph: property.dataGraph,
    scoresGraph: property.scoresGraph,
    focusNode: term as Quad_Subject,
    nodeShapes: nodeShapes as Quad_Subject[],
  });
  return childrenToJs(nested.children(), languages);
}

// sh:memberShape's value is always an array: the property's own path holds exactly one rdf:List
// (getObjects() returns the list head, not its flattened members - see PropertyUIElement.getObjects
// vs. this file's getRdfList unpacking), and each member is converted per memberShapeNodes rather
// than the outer property's own shape. Mirrors shaclToType.ts's resolveMemberType: if the member
// shape expands to its own children, each member is a nested object; otherwise it's a scalar.
async function memberShapeToJs(
  property: PropertyUIElement,
  memberShapeNodes: Term[],
  languages: LanguageRange[],
): Promise<unknown[]> {
  const [headTerm] = property.getObjects();
  if (!headTerm) return [];

  const memberTerms = getRdfList(headTerm, property.dataGraph);

  return Promise.all(
    memberTerms.map(async (memberTerm) => {
      const nested = new NodeUIElement({
        shapesGraph: property.shapesGraph,
        dataGraph: property.dataGraph,
        scoresGraph: property.scoresGraph,
        focusNode: memberTerm as Quad_Subject,
        nodeShapes: memberShapeNodes as Quad_Subject[],
      });
      const children = nested.children();
      if (children.length > 0) return childrenToJs(children, languages);

      if (memberTerm.termType === "Literal") return termToJsValue(memberTerm);
      if (memberTerm.termType === "NamedNode") return memberTerm.value;
      return {};
    }),
  );
}

// A node-level sh:or/sh:xone: pick the branch the focus node already validates against (the same
// rule ChoiceElementComponent uses to pick which branch to render) and merge its properties
// straight into the enclosing object, same as shaclToType.ts unions the branch's object type in
// rather than nesting it under its own key.
async function choiceToJs(
  choice: ChoiceElement,
  languages: LanguageRange[],
): Promise<Record<string, unknown>> {
  const branchShapes = choiceBranchShapes(choice);
  const activeBranch = await detectActiveChoiceBranch(choice, branchShapes);
  if (!activeBranch) return {};

  const children = childrenForShape(
    choice.shapesGraph,
    choice.dataGraph,
    activeBranch,
    choice.focusNode,
    choice.scoresGraph,
    choice.widgetRegistry,
  );
  return childrenToJs(children, languages);
}
