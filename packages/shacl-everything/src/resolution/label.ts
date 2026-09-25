import { bestByLanguage } from "@/helpers/bestByLanguage.ts";
import { hslToHex } from "@/helpers/colorBuckets.ts";
import { dedupeTerms } from "@/helpers/dedupeTerms.ts";
import { factory } from "@/helpers/factory.ts";
import { localNameLabel } from "@/helpers/localNameLabel.ts";
import { rdf, rdfs, sh, shui, st } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
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
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import { orderedValues } from "@/structure/orderedValues.ts";
import type { BCP47, LanguageRange } from "@/types/BCP47.ts";
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
export function effectiveLabelPredicates(
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
): string | undefined {
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

  return undefined;
}

/**
 * A sh:PropertyGroup node's own label: its configured label-predicate value(s) (rdfs:label per
 * spec 8.7, then sh:name as an out-of-spec fallback, or shui:labelPreference if configured),
 * best-matching language, falling back to its local name - the group equivalent of propertyLabel's
 * steps 1/4/5. A group is shape metadata only, not an ontology property/value-node with data-graph
 * labels of its own, so there's no data-graph step to run here.
 */
export function groupDescription({
  node,
  shapesGraph,
  languages,
}: GroupLabelOptions): string | undefined {
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

type OntologyLabelOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
  languages?: BCP47[];
};

/**
 * propertyLabel()'s steps 2-4 alone: P's own configured label path(s), DATA graph then SHAPES
 * graph then scoresGraph - no step 1 (the enclosing property shape's own sh:name) and, unlike
 * propertyLabel() itself, no final local-name fallback. Returns undefined rather than falling back
 * so a caller can tell "no real ontology label" apart from "the label happens to read the same as
 * the local name" (e.g. ex:parent's own rdfs:label is literally "parent" - a string-equality check
 * against localName() would wrongly treat that as no label at all). Exported for exactly that kind
 * of caller: one that wants propertyLabel()'s ontology lookup but its own, more useful fallback
 * when nothing is found (e.g. PropertyAutoComplete falling back to a prefixed IRI, not a bare local
 * name, when picking an arbitrary predicate/class IRI that has no shape of its own to speak of).
 */
export function ontologyLabel({ term, propertyShape, languages }: OntologyLabelOptions): string | undefined {
  const { scoresGraph, shapesGraph, dataGraph } = propertyShape;
  // Chrome (a label), not content - deliberately excludes sh:languageIn, see configuredLanguages.
  const effLanguages = configuredLanguages(shapesGraph, languages ?? []);
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

  return undefined;
}

// 8.2.2 Property Labels
export function propertyLabel({
  term,
  propertyShape,
  languages,
  isPropertyPath,
}: PropertyLabelOptions): string {
  const { shapesGraph } = propertyShape;
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

  // 2-4. The ontology's own label for P, across data graph / shapes graph / scoresGraph.
  const ontology = ontologyLabel({ term, propertyShape, languages });
  if (ontology) return ontology;

  // The ontology (steps 2-4) had nothing in any language either - a wrong-language sh:name is still
  // more useful than the raw local name, so restore the value step 1 set aside above.
  if (fallbackPropertyShapeValue) return fallbackPropertyShapeValue;

  // 4/5. Local-name resolution of P (or, for a non-IRI/complex term, its own value), humanized by
  // splitting into words at camelCase/acronym and letter-digit boundaries.
  return localNameLabel(term) ?? term.value;
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
  for (const path of effectiveDescriptionPredicates()) {
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

/**
 * Whether a reference-picking widget (InstancesSelectEditor/AutoCompleteEditor) can offer its
 * "Create new…" option for this property: it needs a sh:class to type the new instance with, and a
 * valueNodeShapes shape to open the new instance's own fields against - without one, all that could
 * be created is a bare, label-less urn:uuid the user can't do anything further with.
 */
export function canCreateInPlace(propertyShape: PropertyUIElement): boolean {
  return propertyShape.get(sh("class")).length > 0 && valueNodeShapes(propertyShape).length > 0;
}

/**
 * The property paths (sh:path) of every property shape on one of propertyShape's valueNodeShapes
 * that's annotated shui:propertyRole `role`. Exported (not just used internally by the three spec
 * roles below) since it's also the mechanism a non-spec, ShapeThing-original role reuses - e.g.
 * st:MapViewer's st:GeoRole (see its own geometry.ts), marking which property holds a value's
 * geometry the same way shui:LabelRole marks which one holds its label.
 */
export function propertyPathsByRole(
  propertyShape: PropertyUIElement,
  role: NamedNode,
): PropertyPath[] {
  return propertyPathsByRoleForNodeShapes(
    valueNodeShapes(propertyShape),
    propertyShape.shapesGraph,
    role,
  );
}

/**
 * The role-matching half of propertyPathsByRole, taken as plain node shapes rather than derived
 * from a propertyShape's own sh:node/sh:class - shared with colorRolePropertyPaths below, which
 * looks up its node shapes a different way (a value's own rdf:type, not a property's configured
 * class - see ownClassNodeShapes).
 */
function propertyPathsByRoleForNodeShapes(
  nodeShapes: Quad_Subject[],
  shapesGraph: RdfStore,
  role: NamedNode,
): PropertyPath[] {
  return nodeShapes.flatMap((node) =>
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

type LabelRolePath = { path: PropertyPath; mergeAlternatives: boolean };

/**
 * Same match as labelRolePropertyPaths, but paired with each property shape's own
 * st:mergeAlternatives flag - a ShapeThing-original, non-spec escape hatch that opts one
 * sh:alternativePath-typed LabelRole path into "combine every branch" behavior (see
 * resolveLabelRolePathParts) instead of sh:alternativePath's real SHACL meaning (the first branch
 * with a value wins). Kept as a plain sibling triple on the property shape rather than folded into
 * the sh:path expression itself (e.g. a hypothetical st:mergedPaths path type replacing
 * sh:alternativePath), so sh:path stays a spec-legal path expression shacl-engine can still
 * validate the property against.
 */
function labelRolePathEntries(propertyShape: PropertyUIElement): LabelRolePath[] {
  const { shapesGraph } = propertyShape;

  return valueNodeShapes(propertyShape).flatMap((node) =>
    shapesGraph
      .getQuads(node, sh("property"))
      .filter(
        ({ object: property }) =>
          shapesGraph.getQuads(property, shui("propertyRole"), shui("LabelRole")).length > 0,
      )
      .flatMap(({ object: property }) => {
        const path = parsePropertyPath(property, shapesGraph);
        if (!path) return [];
        const mergeAlternatives = shapesGraph
          .getQuads(property, st("mergeAlternatives"))
          .some((quad) => quad.object.value === "true");
        return [{ path, mergeAlternatives }];
      })
  );
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

/**
 * The property paths (sh:path) of every property shape on `propertyShape`'s sh:node (or on any
 * node shape targeting its sh:class via sh:targetClass) that's annotated shui:propertyRole
 * st:DescriptionRole - a longer, free-text summary of a value (e.g. a chef's own biography), as
 * opposed to LabelRole's short display name. Not part of the shui: spec - a ShapeThing-original
 * role, the same kind of extension st:GeoRole is (see st:MapViewer's geometry.ts): declared via
 * the very same generic `shui:propertyRole` predicate, just with an `st:` role value instead of a
 * `shui:` one. Mirrors labelRolePropertyPaths/depictionRolePropertyPaths.
 */
export function descriptionRolePropertyPaths(
  propertyShape: PropertyUIElement,
): PropertyPath[] {
  return propertyPathsByRole(propertyShape, st("DescriptionRole"));
}

/**
 * Every node shape in `shapesGraph` that sh:targetClasses one of `term`'s own rdf:type values in
 * `dataGraph` - what `term` is actually asserted to BE, as opposed to valueNodeShapes' "what a
 * property declares its values look like" (propertyShape's own sh:node/sh:class). Needed because a
 * ClassificationRole/CategoryFacet value can land on a resource of a wholly different class than
 * the enclosing property's own sh:class - e.g. skos:inScheme landing on a skos:ConceptScheme, not
 * another skos:Concept - so st:ColorRole (below) has to be looked up off the value's own type, not
 * the property's. No subclass walk (unlike shaclInstancesOfClass's reverse direction): `term` is
 * matched only against a shape's literal sh:targetClass, not its ancestors.
 */
function ownClassNodeShapes(
  term: Term,
  dataGraph: RdfStore,
  shapesGraph: RdfStore,
): Quad_Subject[] {
  const classes = dataGraph.getQuads(term as Quad_Subject, rdf("type")).map((quad) => quad.object);
  return dedupeTerms(
    classes.flatMap((classIri) => shapesTargetingClass(classIri, shapesGraph)),
  ) as Quad_Subject[];
}

/**
 * The property paths (sh:path) of every property shape on a node shape targeting `term`'s own
 * rdf:type (see ownClassNodeShapes) that's annotated shui:propertyRole st:ColorRole - i.e. what to
 * walk from `term` itself (not from some enclosing property's value) to find a swatch color for
 * it. Not part of the spec; a ShapeThing-original role like st:GeoRole/st:DescriptionRole, but
 * resolved off the value's own class rather than propertyShape's valueNodeShapes - see
 * valueNodeColor.
 */
export function colorRolePropertyPaths(
  term: Term,
  dataGraph: RdfStore,
  shapesGraph: RdfStore,
): PropertyPath[] {
  return propertyPathsByRoleForNodeShapes(
    ownClassNodeShapes(term, dataGraph, shapesGraph),
    shapesGraph,
    st("ColorRole"),
  );
}

// 8.2.3 Value Node Labels
export function valueNodeLabel(options: ValueNodeLabelOptions): Literal {
  return resolveValueNodeLabel(options, new Set());
}

// `visiting` holds the terms whose labels are currently being resolved further up this call
// stack. A LabelRole path that lands on a resource recurses (step 2), so cyclic data along that
// path (A -> B -> A, none with a literal label) would otherwise recurse forever. A term reached a
// second time skips step 2 and falls through to steps 3-6 instead.
function resolveValueNodeLabel(
  { term, propertyShape, languages }: ValueNodeLabelOptions,
  visiting: Set<string>,
): Literal {
  const { shapesGraph, dataGraph } = propertyShape;

  // 1. If V is a literal, use its lexical form as the label.
  if (term.termType === "Literal") {
    return term;
  }

  const effLanguages = effectiveLanguages(propertyShape, languages ?? []);

  // 2. shui:LabelRole-annotated path(s) from V, walked in the data graph. An sh:alternativePath's
  // branches normally follow real SHACL "OR" semantics: the first branch with a value wins. A
  // property shape opted into st:mergeAlternatives instead resolves every branch independently and
  // combines them into one composed label (e.g. a quantity/unit/name triple describing one
  // ingredient becomes "1.0 Kilogram Beef fillet") - see resolveLabelRolePathParts. A branch that
  // resolves to a resource rather than a literal (e.g. schema:unitCode, an IRI) recurses through
  // this same function - e.g. resolving to the unit's own rdfs:label - instead of being silently
  // dropped by a literal-only filter.
  const key = termKey(term);
  let roleLabelParts: string[] = [];
  if (!visiting.has(key)) {
    visiting.add(key);
    try {
      roleLabelParts = labelRolePathEntries(propertyShape).flatMap(({ path, mergeAlternatives }) =>
        resolveLabelRolePathParts(
          path,
          term,
          propertyShape,
          effLanguages,
          languages,
          mergeAlternatives,
          visiting,
        )
      );
    } finally {
      visiting.delete(key);
    }
  }
  if (roleLabelParts.length > 0) {
    return factory.literal(roleLabelParts.join(" "));
  }

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

  // 5. If V is an IRI, use local-name resolution of V, humanized by splitting into words at
  // camelCase/acronym and letter-digit boundaries.
  // 6. If V is a blank node, use an implementation-specific placeholder.
  if (term.termType === "BlankNode") return factory.literal(term.value);
  return factory.literal(localNameLabel(term) ?? term.value);
}

/**
 * One shui:LabelRole path's own contribution to valueNodeLabel's combined text. An
 * sh:alternativePath decomposes into its branches: with `mergeAlternatives` (st:mergeAlternatives),
 * every branch is resolved independently and all of them combine - the empty branches this filters
 * out are what let e.g. an ingredient with no schema:unitCode still combine cleanly into "1.0 Beef
 * fillet" instead of leaving a stray gap. Without it, branches follow real SHACL alternation: the
 * first one with a value wins (early exit), matching the federated SPARQL role lookup's own
 * sample()-based pick-one behavior (see outputs/render/hooks/query.ts's buildRoleLookupQuery). Any
 * other path type walks straight to its value(s): a literal picks the best-language match among
 * them, a resource recurses through valueNodeLabel itself (e.g. schema:unitCode's own rdfs:label)
 * rather than being dropped.
 */
function resolveLabelRolePathParts(
  path: PropertyPath,
  term: Term,
  propertyShape: PropertyUIElement,
  effLanguages: LanguageRange[],
  languages: BCP47[] | undefined,
  mergeAlternatives: boolean,
  visiting: Set<string>,
): string[] {
  if (path.type === "alternative") {
    if (mergeAlternatives) {
      return path.items.flatMap((item) =>
        resolveLabelRolePathParts(
          item,
          term,
          propertyShape,
          effLanguages,
          languages,
          mergeAlternatives,
          visiting,
        )
      );
    }

    for (const item of path.items) {
      const parts = resolveLabelRolePathParts(
        item,
        term,
        propertyShape,
        effLanguages,
        languages,
        mergeAlternatives,
        visiting,
      );
      if (parts.length > 0) return parts;
    }
    return [];
  }

  const values = walkPropertyPath(path, term, propertyShape.dataGraph);
  const literal = language(
    values.filter((v): v is Literal => v.termType === "Literal"),
    effLanguages,
  );
  if (literal) return [literal.value];

  const resource = values.find((v) => v.termType !== "Literal");
  return resource
    ? [resolveValueNodeLabel({ term: resource, propertyShape, languages }, visiting).value]
    : [];
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

type ValueNodeDescriptionOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
  languages?: BCP47[];
};

/**
 * A longer, free-text summary of V (e.g. a chef's own biography): the best-language match from a
 * st:DescriptionRole-annotated path from V in the data graph. Undefined when V is a literal
 * (nothing to walk from) or no such value exists - mirrors valueNodeDepiction, but resolving to a
 * language-selected string rather than an image IRI, the same way propertyDescription resolves a
 * property's own help text.
 */
export function valueNodeDescription({
  term,
  propertyShape,
  languages,
}: ValueNodeDescriptionOptions): string | undefined {
  if (term.termType === "Literal") return undefined;

  const { dataGraph } = propertyShape;
  const effLanguages = effectiveLanguages(propertyShape, languages ?? []);

  const values = descriptionRolePropertyPaths(propertyShape).flatMap((path) =>
    walkPropertyPath(path, term, dataGraph),
  );
  return language(
    values.filter((v): v is Literal => v.termType === "Literal"),
    effLanguages,
  )?.value;
}

type ValueNodeColorOptions = {
  term: Term;
  propertyShape: PropertyUIElement;
};

/**
 * A swatch color for V (e.g. to color a ClassificationRole chip, or a CategoryFacet option): the
 * first literal value of a st:ColorRole-annotated path declared on a node shape targeting one of
 * V's own rdf:type values (see ownClassNodeShapes/colorRolePropertyPaths) - unlike
 * valueNodeDepiction/valueNodeDescription (resolved via propertyShape's own valueNodeShapes), this
 * is resolved off what V is actually asserted to BE, not what the enclosing property declares its
 * values look like. A literal value is returned as-is (a plain CSS color string, e.g. "#ff0000" or
 * "red"); a blank node in st:ColorEditor/st:ColorViewer's own HSL convention (st:hue/
 * st:saturation/st:lightness, see helpers/colorBuckets.ts's Hsl) is converted to hex, same as
 * ColorViewer does for display - no language selection, since color isn't language-dependent.
 * Undefined when V is a literal (no rdf:type of its own) or no such value exists.
 */
export function valueNodeColor({ term, propertyShape }: ValueNodeColorOptions): string | undefined {
  if (term.termType === "Literal") return undefined;

  const { dataGraph, shapesGraph } = propertyShape;

  for (const value of colorRolePropertyPaths(term, dataGraph, shapesGraph)
    .flatMap((path) => walkPropertyPath(path, term, dataGraph))) {
    if (value.termType === "Literal") return value.value;
    const hex = hslNodeToHex(value, dataGraph);
    if (hex) return hex;
  }
  return undefined;
}

// An st:ColorEditor-style HSL blank node's hex, or undefined when it doesn't carry all three
// st:hue/st:saturation/st:lightness triples (yet) - same partial-node handling as ColorViewer.
function hslNodeToHex(node: Term, dataGraph: RdfStore): string | undefined {
  if (node.termType !== "BlankNode" && node.termType !== "NamedNode") return undefined;
  const read = (predicate: NamedNode) =>
    dataGraph.getQuads(node as Quad_Subject, predicate)[0]?.object.value;
  const h = read(st("hue"));
  const s = read(st("saturation"));
  const l = read(st("lightness"));
  if (h === undefined || s === undefined || l === undefined) return undefined;
  return hslToHex({ h: parseFloat(h), s: parseFloat(s), l: parseFloat(l) });
}
