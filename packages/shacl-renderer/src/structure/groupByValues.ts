import type { Literal, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { st } from "@/helpers/namespaces.ts";
import { composeAlternatives } from "@/resolution/composeAlternatives.ts";
import {
  isUnsetPathNode,
  parsePathNode,
  type PropertyPath,
} from "@/structure/paths/parsePropertyPath.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { LanguageRange } from "@/types/BCP47.ts";

/**
 * st:groupBy on a property shape: its object is a property path (same syntax as sh:path), walked
 * from each of the property's values to find the group that value belongs to. View mode shows the
 * values of one group together, under the group's key as a heading - e.g. books by the year they
 * were published.
 */
export function groupByPath(propertyUIElement: PropertyUIElement): PropertyPath | undefined {
  // keepFirst (constraintResolutions.ts) resolves st:groupBy to a single term; see orderByPath.
  const node = propertyUIElement.get(st("groupBy")) as unknown as Term | undefined;
  if (!node || node.termType === "Literal") return undefined;
  if (isUnsetPathNode(node, propertyUIElement.shapesGraph)) return undefined;
  return parsePathNode(node, propertyUIElement.shapesGraph);
}

/** st:groupTemplate: how a value's group key is written, in the syntax of st:mergeTemplate. */
export function groupTemplate(propertyUIElement: PropertyUIElement): string | undefined {
  const term = propertyUIElement.get(st("groupTemplate")) as unknown as Literal | undefined;
  return term?.termType === "Literal" ? term.value : undefined;
}

export type ValueGroup = {
  /** The text the values of the group share; empty for the values that have none. */
  key: string;
  objects: Term[];
};

export type GroupValuesOptions = {
  path: PropertyPath;
  template: string | undefined;
  dataGraph: RdfStore;
  languages: LanguageRange[];
  locale: string;
  /** The text for a resource the path reaches, e.g. its own label. */
  labelOf: (term: Term) => string;
};

/**
 * `objects` in groups by the text st:groupBy reaches from each of them. The path's alternatives
 * (or the path itself, when it has none) are the {0}, {1}, ... of st:groupTemplate, filled in the
 * way st:mergeTemplate is (see composeAlternatives): "[{0:year}|{1:year}]" groups by the year of
 * the first alternative that has a date. Without a template the texts of the alternatives that
 * have one are joined with a space.
 *
 * The groups keep the order of `objects` (as st:orderBy put them): a group is where its first
 * value is, and its values are in their own order. The values without a key share one group.
 */
export function groupValues(objects: readonly Term[], options: GroupValuesOptions): ValueGroup[] {
  const { path, template, dataGraph, languages, locale, labelOf } = options;
  const branches = path.type === "alternative" ? path.items : [path];
  const groups = new Map<string, ValueGroup>();
  for (const object of objects) {
    const key =
      object.termType === "Literal"
        ? ""
        : (composeAlternatives({
            branches,
            term: object,
            dataGraph,
            languages,
            locale,
            template,
            labelOf,
          }) ?? "");
    const group = groups.get(key);
    if (group) group.objects.push(object);
    else groups.set(key, { key, objects: [object] });
  }
  return [...groups.values()];
}
