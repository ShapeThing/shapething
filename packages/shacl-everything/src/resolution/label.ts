import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { factory } from "@/helpers/factory.ts";
import { localName } from "@/helpers/localName.ts";
import { rdfs, sh, shui } from "@/helpers/namespaces.ts";
import language, {
  configuredLanguages,
  effectiveLanguages,
} from "@/resolution/language.ts";
import { getLabelPreference } from "@/resolution/globalConfiguration.ts";
import {
  parsePropertyPath,
  type PropertyPath,
} from "@/structure/paths/parsePropertyPath.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
import {
  orderedValues,
  type PropertyUIElement,
} from "@/structure/PropertyUIElement.ts";
import type { BCP47 } from "@/types/BCP47.ts";
import { shapesTargetingClass } from "@/resolution/targets.ts";
import type { Literal, NamedNode, Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";

type PropertyLabelOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
  languages?: BCP47[];
  // Gates 8.2.2 step 1 (the property shape's own configured label-predicate value, e.g. sh:name).
  // True only when `term` IS propertyShape's own sh:path terminal predicate (see
  // PropertyUIElement.label()). Other callers (e.g. WidgetSwitcher labeling widget IRIs,
  // SubClassEditor labeling class/root nodes and chip values) reuse propertyLabel purely for steps
  // 2-5 - term/graph label lookup + local-name fallback - using propertyShape only as graph/language
  // context; folding step 1 in unconditionally there would incorrectly surface the enclosing
  // property's own sh:name instead of `term`'s.
  isPropertyPath?: boolean;
};

type LabelPreferenceContext = "propertyShape" | "term" | "group";

// Label property resolution (8.2.1): shui:labelPreference, when configured, is applied uniformly
// across every step that consults it. The *default* (when unconfigured) is context-dependent -
// sh:name for a property shape's own metadata (propertyLabel step 1, and branchLabel's equivalent),
// rdfs:label for describing a predicate/value-node IRI's own vocabulary term (propertyLabel steps
// 2-3, valueNodeLabel steps 3-4). A sh:PropertyGroup's label is spec'd (8.7) as rdfs:label, checked
// first, but sh:name is tried as a second fallback since shapes in the wild commonly (if
// out-of-spec) reuse sh:name on a group the way they do on a property shape.
function effectiveLabelPredicates(
  shapesGraph: RdfStore,
  context: LabelPreferenceContext,
): PropertyPath[] {
  const configured = getLabelPreference(shapesGraph);
  if (configured.length > 0) return configured;
  if (context === "propertyShape") {
    return [{ type: "predicate", predicate: sh("name") }];
  }
  if (context === "group") {
    return [
      { type: "predicate", predicate: rdfs("label") },
      { type: "predicate", predicate: sh("name") },
    ];
  }
  return [{ type: "predicate", predicate: rdfs("label") }];
}

type GroupLabelOptions = {
  node: Term;
  shapesGraph: RdfStore;
  languages?: BCP47[];
};

/**
 * A sh:PropertyGroup node's own label: its configured label-predicate value(s) (rdfs:label per
 * spec 8.7, then sh:name as an out-of-spec fallback, or shui:labelPreference if configured),
 * best-matching language, falling back to its local name - the group equivalent of propertyLabel's
 * steps 1/4/5. A group is shape metadata only, not an ontology property/value-node with data-graph
 * labels of its own, so there's no data-graph step to run here.
 */
export function groupLabel(
  { node, shapesGraph, languages }: GroupLabelOptions,
): string {
  const effLanguages = configuredLanguages(shapesGraph, languages ?? []);

  for (const path of effectiveLabelPredicates(shapesGraph, "group")) {
    if (path.type !== "predicate") continue;
    const literal = language(
      shapesGraph
        .getQuads(node, path.predicate)
        .map((quad) => quad.object)
        .filter((value): value is Literal => value.termType === "Literal"),
      effLanguages,
    );
    if (literal) return literal.value;
  }

  return localName(node) ?? node.value;
}

/**
 * A sh:PropertyGroup node's own label: its configured label-predicate value(s) (rdfs:label per
 * spec 8.7, then sh:name as an out-of-spec fallback, or shui:labelPreference if configured),
 * best-matching language, falling back to its local name - the group equivalent of propertyLabel's
 * steps 1/4/5. A group is shape metadata only, not an ontology property/value-node with data-graph
 * labels of its own, so there's no data-graph step to run here.
 */
export function groupDescription(
  { node, shapesGraph, languages }: GroupLabelOptions,
): string | undefined {
  const effLanguages = configuredLanguages(shapesGraph, languages ?? []);

  for (const path of effectiveDescriptionPredicates()) {
    if (path.type !== "predicate") continue;
    const literal = language(
      shapesGraph
        .getQuads(node, path.predicate)
        .map((quad) => quad.object)
        .filter((value): value is Literal => value.termType === "Literal"),
      effLanguages,
    );
    if (literal) return literal.value;
  }
  return undefined;
}

// 8.2.2 Property Labels
export function propertyLabel({
  term,
  propertyShape,
  languages,
  isPropertyPath,
}: PropertyLabelOptions): string {
  const { scoresGraph, shapesGraph, dataGraph } = propertyShape;
  // Chrome (a label), not content - deliberately excludes sh:languageIn, see configuredLanguages.
  const effLanguages = configuredLanguages(shapesGraph, languages ?? []);

  // 1. The property shape's own configured label-predicate value(s) - shape-local metadata, so only
  // "predicate"-typed configured paths apply (a complex path can't be read as direct shape metadata).
  //
  // Deliberate divergence from the spec's literal step order: a strict language match only (or a
  // language-less value - see bestByLanguage's `strict` option), not PropertyUIElement.get()'s usual
  // loose "fall back to whatever language is there" behavior. sh:name is authored per shape and often
  // only translated into some languages, while the ontology's own rdfs:label (steps 2/3 below) may
  // cover a language sh:name doesn't - silently accepting a wrong-language sh:name here would
  // permanently hide a better-matching ontology label behind it. Any wrong-language value found here
  // is kept as `fallbackPropertyShapeValue` and only used once the ontology has also had its chance
  // (see the bottom of this function), so a translated ontology term still wins, but a shape that
  // simply has no ontology label at all still shows *something* better than the raw local name.
  let fallbackPropertyShapeValue: string | undefined;
  if (isPropertyPath) {
    for (const path of effectiveLabelPredicates(shapesGraph, "propertyShape")) {
      if (path.type !== "predicate") continue;
      const values = orderedValues(propertyShape, path.predicate);
      const value = bestByLanguage(values, effLanguages, { strict: true });
      if (value) return value.value;
      fallbackPropertyShapeValue ??= bestByLanguage(values, effLanguages)
        ?.value;
    }
  }

  const termLabelPaths = effectiveLabelPredicates(shapesGraph, "term");

  // 2. DATA graph, subject P, configured label path(s) - checked before the shapes graph (order
  // matters, per 8.2.2). Predicate-list-then-language-select: the first configured path with ANY
  // matching literal wins, rather than merging every path's candidates before language-selecting
  // across all of them - a higher-priority label predicate (e.g. skos:prefLabel) should win even if
  // only available in a non-preferred language, rather than losing to a lower-priority predicate
  // that happens to have a better-matching language.
  for (const path of termLabelPaths) {
    const literal = language(
      walkPropertyPath(path, term, dataGraph).filter((v): v is Literal =>
        v.termType === "Literal"
      ),
      effLanguages,
    );
    if (literal) return literal.value;
  }

  // 3. SHAPES graph, subject P, configured label path(s).
  for (const path of termLabelPaths) {
    const literal = language(
      walkPropertyPath(path, term, shapesGraph).filter(
        (v): v is Literal => v.termType === "Literal",
      ),
      effLanguages,
    );
    if (literal) return literal.value;
  }

  // Non-spec extension: scoresGraph (e.g. a widget registry entry's own rdfs:label) - tried after
  // the spec's own data/shapes-graph steps, before falling back to the local name.
  const scoresLabel = language(
    scoresGraph.getQuads(term, rdfs("label")).map(({ object }) =>
      object as Literal
    ),
    effLanguages,
  );
  if (scoresLabel) return scoresLabel.value;

  // The ontology (steps 2-4) had nothing in any language either - a wrong-language sh:name is still
  // more useful than the raw local name, so restore the value step 1 set aside above.
  if (fallbackPropertyShapeValue) return fallbackPropertyShapeValue;

  // 4/5. Local-name resolution of P (or, for a non-IRI/complex term, its own value).
  return localName(term) ?? term.value;
}

type PropertyDescriptionOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
  languages?: BCP47[];
};

function effectiveDescriptionPredicates(): PropertyPath[] {
  return [
    { type: "predicate", predicate: sh("description") },
    { type: "predicate", predicate: rdfs("comment") },
  ];
}

/**
 * A property's description/help text, mirroring propertyLabel()'s own divergence from a literal
 * spec step order: the property shape's own configured description value (sh:description by
 * default) only if it has a value in the interface language being rendered, otherwise the ontology
 * property the path targets (rdfs:comment by default), otherwise sh:description again in whatever
 * language it does have. Unlike propertyLabel(), there's no local-name fallback - a property simply
 * has no description when nothing matches, which is fine since callers only render it when truthy.
 */
export function propertyDescription({
  term,
  propertyShape,
  languages,
}: PropertyDescriptionOptions): string | undefined {
  const { shapesGraph, dataGraph } = propertyShape;
  // Chrome (a label), not content - deliberately excludes sh:languageIn, see configuredLanguages.
  const effLanguages = configuredLanguages(shapesGraph, languages ?? []);

  let fallbackPropertyShapeValue: string | undefined;
  for (
    const path of effectiveDescriptionPredicates()
  ) {
    if (path.type !== "predicate") continue;
    const values = orderedValues(propertyShape, path.predicate);
    const value = bestByLanguage(values, effLanguages, { strict: true });
    if (value) return value.value;
    fallbackPropertyShapeValue ??= bestByLanguage(values, effLanguages)?.value;
  }

  const termDescriptionPaths = effectiveDescriptionPredicates();

  for (const path of termDescriptionPaths) {
    const literal = language(
      walkPropertyPath(path, term, dataGraph).filter((v): v is Literal =>
        v.termType === "Literal"
      ),
      effLanguages,
    );
    if (literal) return literal.value;
  }

  for (const path of termDescriptionPaths) {
    const literal = language(
      walkPropertyPath(path, term, shapesGraph).filter(
        (v): v is Literal => v.termType === "Literal",
      ),
      effLanguages,
    );
    if (literal) return literal.value;
  }

  return fallbackPropertyShapeValue;
}

type ValueNodeLabelOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
  languages?: BCP47[];
};

/**
 * The node shape(s) describing a property's value: its own explicit sh:node, unioned with any
 * node shape in shapesGraph that targets its sh:class via sh:targetClass (see resolution/
 * targets.ts's shapesTargetingClass) - so a property that only declares sh:class still resolves to
 * a real shape to render/label a referenced value against, without redundantly restating sh:node.
 * Shared by propertyPathsByRole below and anything else that needs to know which shape governs a
 * referenced resource's own fields (e.g. editInPlace/createInPlace).
 */
export function valueNodeShapes(
  propertyShape: PropertyUIElement,
): Quad_Subject[] {
  const { shapesGraph } = propertyShape;
  const explicitNodes = propertyShape.get(sh("node")) as Quad_Subject[];
  const classNodes = propertyShape
    .get(sh("class"))
    .flatMap((classIri) => shapesTargetingClass(classIri, shapesGraph));
  return [...explicitNodes, ...classNodes];
}

// The property paths (sh:path) of every property shape on one of propertyShape's valueNodeShapes
// that's annotated shui:propertyRole `role`.
function propertyPathsByRole(
  propertyShape: PropertyUIElement,
  role: NamedNode,
): PropertyPath[] {
  const { shapesGraph } = propertyShape;

  return valueNodeShapes(propertyShape).flatMap((node) =>
    shapesGraph
      .getQuads(node, sh("property"))
      .filter(
        ({ object: property }) =>
          shapesGraph.getQuads(property, shui("propertyRole"), role).length > 0,
      )
      .map(({ object: property }) => parsePropertyPath(property, shapesGraph))
      .filter((path): path is PropertyPath => path !== null)
  );
}

/**
 * The property paths (sh:path) of every property shape on `propertyShape`'s sh:node (or on any
 * node shape targeting its sh:class via sh:targetClass) that's annotated shui:propertyRole
 * shui:LabelRole - i.e. what to walk from a value node to find its display label. Shared by
 * valueNodeLabel (walks the path per value) and anything that instead needs the path itself, e.g.
 * to build a SPARQL query (see structure/paths/toSparql.ts).
 */
export function labelRolePropertyPaths(
  propertyShape: PropertyUIElement,
): PropertyPath[] {
  return propertyPathsByRole(propertyShape, shui("LabelRole"));
}

/**
 * The property paths (sh:path) of every property shape on `propertyShape`'s sh:node (or on any
 * node shape targeting its sh:class via sh:targetClass) that's annotated shui:propertyRole
 * shui:DepictionRole - i.e. what to walk from a value node to find an image representing it.
 * Mirrors labelRolePropertyPaths.
 */
export function depictionRolePropertyPaths(
  propertyShape: PropertyUIElement,
): PropertyPath[] {
  return propertyPathsByRole(propertyShape, shui("DepictionRole"));
}

/**
 * The property paths (sh:path) of every property shape on `propertyShape`'s sh:node (or on any
 * node shape targeting its sh:class via sh:targetClass) that's annotated shui:propertyRole
 * shui:ClassificationRole - secondary, disambiguating info shown alongside the main LabelRole label
 * (e.g. a pseudonym next to a person's name, or a linked concept's own scheme). The path may end on
 * a literal directly or on a resource - see valueNodeClassification for how the latter then gets
 * its own label resolved. Mirrors labelRolePropertyPaths.
 */
export function classificationRolePropertyPaths(
  propertyShape: PropertyUIElement,
): PropertyPath[] {
  return propertyPathsByRole(propertyShape, shui("ClassificationRole"));
}

// 8.2.3 Value Node Labels
export function valueNodeLabel(
  { term, propertyShape, languages }: ValueNodeLabelOptions,
): Literal {
  const { shapesGraph, dataGraph } = propertyShape;

  // 1. If V is a literal, use its lexical form as the label.
  if (term.termType === "Literal") {
    return term;
  }

  const effLanguages = effectiveLanguages(propertyShape, languages ?? []);

  // 2. shui:LabelRole-annotated path(s) from V, walked in the data graph.
  const labelsViaPropertyRoles = labelRolePropertyPaths(propertyShape)
    .flatMap((path) => walkPropertyPath(path, term, dataGraph))
    .filter((value): value is Literal => value.termType === "Literal");
  const viaRoles = language(labelsViaPropertyRoles, effLanguages);
  if (viaRoles) return viaRoles;

  const labelPaths = effectiveLabelPredicates(shapesGraph, "term");

  // 3. DATA graph, subject V, configured label path(s) (default rdfs:label).
  for (const path of labelPaths) {
    const literal = language(
      walkPropertyPath(path, term, dataGraph).filter((v): v is Literal =>
        v.termType === "Literal"
      ),
      effLanguages,
    );
    if (literal) return literal;
  }

  // 4. SHAPES graph, subject V, configured label path(s).
  for (const path of labelPaths) {
    const literal = language(
      walkPropertyPath(path, term, shapesGraph).filter(
        (v): v is Literal => v.termType === "Literal",
      ),
      effLanguages,
    );
    if (literal) return literal;
  }

  // 5. If V is an IRI, use local-name resolution of V.
  // 6. If V is a blank node, use an implementation-specific placeholder.
  if (term.termType === "BlankNode") return factory.literal(term.value);
  return factory.literal(localName(term) ?? term.value);
}

type ValueNodeClassificationOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
  languages?: BCP47[];
};

/**
 * Secondary, disambiguating info for V: the best-language match from a shui:ClassificationRole-
 * annotated path from V in the data graph (e.g. a pseudonym alongside a person's name, or a linked
 * concept's own scheme). The path's end can be either a literal directly (e.g. skos:definition) or
 * a resource (e.g. skos:inScheme, landing on a skos:ConceptScheme) - a resource is kept as `term`
 * as-is (so e.g. a chip can still link out to it), with `label` resolved via valueNodeLabel *again*,
 * this time rooted at that resource rather than V - the same recursive "find this term's own label"
 * step a resource's own LabelRole/rdfs:label would otherwise apply to V itself. Not part of the
 * spec; a project-specific extension mirroring valueNodeLabel's step 2 only for the initial
 * ClassificationRole hop.
 */
export function valueNodeClassification({
  term,
  propertyShape,
  languages,
}: ValueNodeClassificationOptions): { term: Term; label: string } | undefined {
  if (term.termType === "Literal") return undefined;

  const { dataGraph } = propertyShape;
  const effLanguages = effectiveLanguages(propertyShape, languages ?? []);
  const classifications = classificationRolePropertyPaths(propertyShape)
    .flatMap((path) => walkPropertyPath(path, term, dataGraph));

  const classification = classifications.length > 0
    ? language(classifications, effLanguages)
    : undefined;
  if (!classification) return undefined;
  if (classification.termType === "Literal") {
    return { term: classification, label: classification.value };
  }

  return {
    term: classification,
    label:
      valueNodeLabel({ term: classification, propertyShape, languages }).value,
  };
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
