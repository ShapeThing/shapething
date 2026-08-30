import type { Literal, NamedNode, Term } from "@rdfjs/types";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";

import { localName } from "@/helpers/localName.ts";
import { rdfs, sh, xsd } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";

export type ResolutionFunction<T> = (
  values: Term[],
  element: PropertyUIElement,
  predicate: Term,
) => T;

// xsd:date/dateTime-family literals sort by calendar time; everything else sorts numerically,
// which covers every datatype sh:minExclusive/minInclusive/maxExclusive/maxInclusive apply to.
const DATE_DATATYPES = new Set(
  [
    xsd("date"),
    xsd("dateTime"),
    xsd("gYear"),
    xsd("gYearMonth"),
    xsd("gMonthDay"),
    xsd("gDay"),
  ].map((datatype) => datatype.value),
);

function literalOrder(term: Term): number {
  const datatype = (term as Literal).datatype?.value;
  return datatype && DATE_DATATYPES.has(datatype)
    ? new Date(term.value).getTime()
    : parseFloat(term.value);
}

export const keepHighestLiteral: ResolutionFunction<number | undefined> = (values) => {
  if (!values.length) return undefined;
  return literalOrder(
    values.reduce((highest, term) => (literalOrder(term) > literalOrder(highest) ? term : highest)),
  );
};

export const keepLowestLiteral: ResolutionFunction<number | undefined> = (values) => {
  if (!values.length) return undefined;
  return literalOrder(
    values.reduce((lowest, term) => (literalOrder(term) < literalOrder(lowest) ? term : lowest)),
  );
};

export const keepHighestInteger: ResolutionFunction<number | undefined> = (values) => {
  if (!values.length) return undefined;
  return Math.max(...values.map((term) => parseInt(term.value)));
};

export const keepLowestInteger: ResolutionFunction<number | undefined> = (values) => {
  if (!values.length) return undefined;
  return Math.min(...values.map((term) => parseInt(term.value)));
};

// Values are gathered in ascending sh:order across shapes, so `values[0]` already is "the first
// value declared by the lowest-order shape that declares one" - shapes without a value contribute
// nothing to the array, so there is nothing to skip over.
export const keepFirst: ResolutionFunction<Term | undefined> = (values) => values[0];

export const keepAll: ResolutionFunction<Term[]> = (values) => dedupeTerms(values);

export const keepAllListItems: ResolutionFunction<Term[]> = (values, element) => {
  return dedupeTerms(values.flatMap((value) => expandListOrTerm(value, element.shapesGraph)));
};

export const keepListIntersection: ResolutionFunction<Term[]> = (values, element) => {
  if (!values.length) return [];
  const sets = values.map((value) => dedupeTerms(expandListOrTerm(value, element.shapesGraph)));
  return sets.reduce((acc, set) => acc.filter((term) => set.some((other) => other.equals(term))));
};

// sh:pattern applies conjunctively: a value must match every declared pattern. Combined into one
// RegExp via lookaheads so consumers get a single object to test against (e.g. new RegExp / .source
// for <input pattern>).
export const combinePatterns: ResolutionFunction<RegExp | undefined> = (values) => {
  const patterns = dedupeTerms(values);
  if (!patterns.length) return undefined;
  if (patterns.length === 1) return new RegExp(patterns[0].value);
  const combined = patterns.map((p) => `(?=.*(?:${p.value}))`).join("");
  return new RegExp(combined);
};

export const resolveBooleans: ResolutionFunction<boolean | undefined> = (values) => {
  if (!values.length) return undefined;
  return values.some((term) => term.value === "true");
};

export const enforceSame: ResolutionFunction<Term | undefined> = (values, _element, predicate) => {
  const unique = dedupeTerms(values);
  if (unique.length > 1) {
    throw new Error(
      `Conflicting values for property ${predicate.value}: ${unique
        .map((term) => term.value)
        .join(", ")}`,
    );
  }
  return unique[0];
};

export function enforceSingular(
  resolve: ResolutionFunction<Term[]>,
): ResolutionFunction<Term | undefined> {
  return (values, element, predicate) => {
    const result = resolve(values, element, predicate);
    if (result.length > 1) {
      throw new Error(
        `Expected a singular value for ${localName(predicate)} but found disjoint values: ${result
          .map((term) => localName(term) ?? term.value)
          .join(", ")}`,
      );
    }
    return result[0];
  };
}

// sh:class ex:Dog, ex:Animal means a value must be a Dog (Dog being the more specific class); this
// keeps only the classes that are not an ancestor (via rdfs:subClassOf) of another declared class.
export const keepMostSpecificClasses: ResolutionFunction<Term[]> = (values, element) => {
  const classes = dedupeTerms(values);
  const ancestorsOf = new Map<string, Term[]>();

  for (const classEntry of classes) {
    const ancestors: Term[] = [];
    let frontier = [classEntry];
    while (frontier.length > 0) {
      const next: Term[] = [];
      for (const node of frontier) {
        for (const quad of element.shapesGraph.getQuads(node, rdfs("subClassOf"))) {
          ancestors.push(quad.object);
          next.push(quad.object);
        }
      }
      frontier = next;
    }
    ancestorsOf.set(termKey(classEntry), ancestors);
  }

  return classes.filter((classEntry) => {
    return !classes.some((otherClass) => {
      if (classEntry.equals(otherClass)) return false;
      return ancestorsOf.get(termKey(otherClass))?.some((ancestor) => ancestor.equals(classEntry));
    });
  });
};

// sh:severity indicates how severe a shape's violations are; sh:Violation is the strictest (and
// SHACL's spec default when absent - left to callers to apply, same as sh:minCount's default of
// 0), then sh:Warning, then sh:Info. When grouped shapes disagree, the most severe wins, since
// that is the worst case a violation of this element could represent.
// TODO implement the structure from SHACL 1.2 here.
const SEVERITY_RANK = new Map<string, number>([
  [sh("Violation").value, 2],
  [sh("Warning").value, 1],
  [sh("Info").value, 0],
]);

export const keepMostSevere: ResolutionFunction<Term | undefined> = (values) => {
  if (!values.length) return undefined;
  return values.reduce((mostSevere, term) =>
    (SEVERITY_RANK.get(term.value) ?? 0) > (SEVERITY_RANK.get(mostSevere.value) ?? 0)
      ? term
      : mostSevere,
  );
};

export const NODE_KIND_COMBINATIONS = new Map<string, NamedNode[]>([
  [sh("BlankNode").value, [sh("BlankNode")]],
  [sh("IRI").value, [sh("IRI")]],
  [sh("Literal").value, [sh("Literal")]],
  [sh("BlankNodeOrIRI").value, [sh("BlankNode"), sh("IRI")]],
  [sh("BlankNodeOrLiteral").value, [sh("BlankNode"), sh("Literal")]],
  [sh("IRIOrLiteral").value, [sh("IRI"), sh("Literal")]],
  [sh("TripleTerm").value, [sh("TripleTerm")]],
]);

export const nodeKindIntersection: ResolutionFunction<Term[]> = (values, element) => {
  if (!values.length) return [];
  const sets = values.map((value) =>
    dedupeTerms(
      expandListOrTerm(value, element.shapesGraph).flatMap(
        (item) => NODE_KIND_COMBINATIONS.get(item.value) ?? [item],
      ),
    ),
  );

  const intersection = sets.reduce((acc, set) =>
    acc.filter((term) => set.some((other) => other.equals(term))),
  );

  if (intersection.length === 0) {
    throw new Error(
      `No intersection found for sh:nodeKind: ${sets
        .map((set) => set.map((term) => localName(term)).join(", "))
        .join(" | ")}`,
    );
  }

  return intersection;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolutions = new Map<string, ResolutionFunction<any>>([
  [sh("class").value, keepMostSpecificClasses],
  [sh("datatype").value, enforceSingular(keepMostSpecificClasses)],
  [sh("nodeKind").value, nodeKindIntersection],
  [sh("minCount").value, keepHighestInteger],
  [sh("maxCount").value, keepLowestInteger],
  [sh("minExclusive").value, keepHighestLiteral],
  [sh("minInclusive").value, keepHighestLiteral],
  [sh("maxExclusive").value, keepLowestLiteral],
  [sh("maxInclusive").value, keepLowestLiteral],
  [sh("minLength").value, keepHighestInteger],
  [sh("maxLength").value, keepLowestInteger],
  [sh("pattern").value, combinePatterns],
  [sh("singleLine").value, resolveBooleans],
  [sh("languageIn").value, keepListIntersection],
  [sh("uniqueLang").value, resolveBooleans],
  [sh("memberShape").value, keepAll],
  [sh("minListLength").value, keepHighestInteger],
  [sh("maxListLength").value, keepLowestInteger],
  [sh("uniqueMembers").value, resolveBooleans],
  [sh("equals").value, enforceSame],
  [sh("disjoint").value, keepAll],
  [sh("subsetOf").value, keepAll],
  [sh("lessThan").value, keepAll],
  [sh("lessThanOrEquals").value, keepAll],
  [sh("not").value, keepAll],
  [sh("and").value, keepAll],
  [sh("or").value, keepAll],
  [sh("xone").value, keepAll],
  [sh("node").value, keepAll],
  [sh("property").value, keepAll],
  [sh("someValue").value, keepAll],
  [sh("qualifiedValueShape").value, keepAll],
  [sh("qualifiedMinCount").value, keepHighestInteger],
  [sh("qualifiedMaxCount").value, keepLowestInteger],
  [sh("reificationRequired").value, resolveBooleans],
  [sh("closed").value, resolveBooleans],
  [sh("ignoredProperties").value, keepAllListItems],
  [sh("hasValue").value, enforceSingular(keepAll)],
  [sh("in").value, keepListIntersection],
  [sh("rootClass").value, keepMostSpecificClasses],
  [sh("uniqueValuesFor").value, keepAllListItems],
  [sh("severity").value, keepMostSevere],
  [sh("name").value, keepFirst],
  [sh("description").value, keepAll],
  [sh("intent").value, keepAll],
  [sh("agentInstruction").value, keepAll],
  [sh("codeIdentifier").value, keepFirst],
  [sh("unit").value, keepAll],
  [sh("order").value, keepLowestInteger],
  [sh("group").value, keepFirst],
]);
