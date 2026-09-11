import type { NamedNode, Quad, Quad_Object, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, rdfs, sh, st, xsd } from "@/helpers/namespaces.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { facetableRootShapes, shapesTargetingClass } from "@/resolution/targets.ts";

// Every distinct rdf:type object used anywhere in `dataGraph`. Blank-node "classes" are excluded -
// sh:targetClass can only ever point at a NamedNode, so a blank-node type could never be covered by
// a generated shape anyway.
function classesUsedInData(dataGraph: RdfStore): NamedNode[] {
  const seen = new Set<string>();
  const classes: NamedNode[] = [];
  for (const quad of dataGraph.getQuads(null, rdf("type"))) {
    if (quad.object.termType !== "NamedNode") continue;
    if (seen.has(quad.object.value)) continue;
    seen.add(quad.object.value);
    classes.push(quad.object);
  }
  return classes;
}

// Same target kinds resolution/targets.ts's targetsOfShape recognizes as covering a class: an
// explicit sh:targetClass (3.1.3.2), or an implicit class-shape/sh:ShapeClass declaration
// (3.1.3.3). A class covered this way is left alone entirely, even if the shape doesn't declare
// every property its instances actually carry in dataGraph - that's the shape author's own choice,
// not something this preprocessor should second-guess by bolting extra sh:property entries onto an
// already-authored shape.
function classAlreadyHasShape(
  classIri: NamedNode,
  shapesGraph: RdfStore,
): boolean {
  if (shapesTargetingClass(classIri, shapesGraph).length > 0) return true;

  const isShapeClass =
    shapesGraph.getQuads(classIri, rdf("type"), sh("ShapeClass")).length > 0;
  const isExplicitShapeAndClass =
    (shapesGraph.getQuads(classIri, rdf("type"), sh("NodeShape")).length > 0 ||
      shapesGraph.getQuads(classIri, rdf("type"), sh("PropertyShape")).length >
        0) &&
    shapesGraph.getQuads(classIri, rdf("type"), rdfs("Class")).length > 0;
  return isShapeClass || isExplicitShapeAndClass;
}

// Every predicate actually used on dataGraph's own instances of `classIri` - rdf:type itself
// excluded, since every SHACL instance carries it by definition and the generated shape already
// covers it implicitly (see addMissingShapes below).
function predicatesUsedByInstancesOf(
  classIri: NamedNode,
  dataGraph: RdfStore,
): NamedNode[] {
  const seen = new Set<string>();
  const predicates: NamedNode[] = [];
  for (
    const { subject: instance } of dataGraph.getQuads(
      null,
      rdf("type"),
      classIri,
    )
  ) {
    for (const quad of dataGraph.getQuads(instance)) {
      if (quad.predicate.equals(rdf("type"))) continue;
      if (quad.predicate.termType !== "NamedNode") continue;
      if (seen.has(quad.predicate.value)) continue;
      seen.add(quad.predicate.value);
      predicates.push(quad.predicate);
    }
  }
  return predicates;
}

/**
 * Opt-in (Environment.enableMissingShapesGeneration, off by default) shape inference: for every
 * class found via rdf:type anywhere in dataGraph that no shape in shapesGraph already covers (see
 * classAlreadyHasShape), mints a node shape with one bare sh:property/sh:path per predicate
 * actually used by that class's own instances, so data that otherwise has no shape at all still
 * renders as something editable.
 *
 * The generated shape's own subject is `classIri` itself, typed both sh:NodeShape and rdfs:Class -
 * 3.1.3.3's "implicit class target" pattern, already recognized everywhere else in this codebase
 * that resolves targets (resolution/targets.ts's targetsOfShape, facetableRootShapes) - rather than
 * a fresh sh:targetClass-pointing blank/synthetic node. This makes the generated shape's identity
 * predictable: a caller who already knows the class IRI (e.g. to set Environment.nodeShapes) can
 * reference it directly, with no need to inspect the generated shapesGraph first to find an opaque
 * generated id.
 *
 * Deliberately minimal: a generated property shape carries no sh:datatype/sh:class/sh:name/
 * sh:maxCount/etc, so widget scoring falls back to its own generic-value heuristics the same as it
 * would for any other under-specified property shape - this is a fallback for unshaped data, not a
 * replacement for actually authoring a shape. Classes already covered by some shape are left
 * completely untouched, even if that shape doesn't declare every property its instances carry.
 *
 * Copies shapesGraph into a fresh RdfStore rather than mutating the caller-supplied one in place -
 * shapesGraph is frequently a shared, module-level fixture reused across multiple
 * stories/renders/tests, so mutating it directly would leak generated shapes into unrelated runs
 * (same non-mutating approach as scoringGraphPreparation.ts's prepareScoringGraph).
 *
 * Runs after resolveRdfSources (so both graphs are resolved RdfStores, even though RawEnvironment's
 * type still allows an unresolved RdfSource) and before prepareEnvironmentScoringGraph, so any
 * shapes minted here are covered by scoring too.
 */
export const addMissingShapes: Preprocessor = (environment) => {
  if (!environment.enableMissingShapesGeneration) return environment;

  const dataGraph = environment.dataGraph as RdfStore;

  const shapesGraph = RdfStore.createDefault();
  for (const quad of (environment.shapesGraph as RdfStore).getQuads()) {
    shapesGraph.addQuad(quad);
  }

  for (const classIri of classesUsedInData(dataGraph)) {
    if (classAlreadyHasShape(classIri, shapesGraph)) continue;

    const predicates = predicatesUsedByInstancesOf(classIri, dataGraph);
    if (predicates.length === 0) continue;

    shapesGraph.addQuad(factory.quad(classIri, rdf("type"), sh("NodeShape")));
    shapesGraph.addQuad(factory.quad(classIri, rdf("type"), rdfs("Class")));

    for (const predicate of predicates) {
      const propertyNode = factory.blankNode();
      shapesGraph.addQuad(factory.quad(propertyNode, sh("path"), predicate));
      shapesGraph.addQuad(factory.quad(classIri, sh("property"), propertyNode));
    }
  }

  return { ...environment, shapesGraph };
};

// A property shape counts as mergeable when it declares sh:datatype xsd:string or rdf:langString
// (expandListOrTerm handles SHACL 1.2's "sh:datatype may be a list" form too) and does NOT already
// carry its own st:facet - facet widgets are otherwise entirely hardcoded via st:facet, so a
// property already given one deliberately keeps it and is left out of the merge. Returns the
// property's own sh:path predicate (undefined if it's mergeable but its path isn't a plain
// predicate - a compound path isn't a valid sh:alternativePath branch worth folding in here).
function mergeableTextSearchPath(propertyNode: Term, shapesGraph: RdfStore): NamedNode | undefined {
  if (shapesGraph.getQuads(propertyNode, st("facet")).length > 0) return undefined;

  const hasTextDatatype = shapesGraph
    .getQuads(propertyNode, sh("datatype"))
    .some((quad) =>
      expandListOrTerm(quad.object, shapesGraph).some(
        (datatype) => datatype.equals(xsd("string")) || datatype.equals(rdf("langString")),
      ),
    );
  if (!hasTextDatatype) return undefined;

  const pathNode = shapesGraph.getQuads(propertyNode, sh("path"))[0]?.object;
  return pathNode?.termType === "NamedNode" ? pathNode : undefined;
}

/**
 * Opt-in (Environment.enableFacetTextSearchMerging, off by default), facet-mode-only preprocessor:
 * for every facetable root shape (resolution/targets.ts's facetableRootShapes), folds every one of
 * its own sh:property entries that's an xsd:string/rdf:langString literal with no st:facet of its
 * own (mergeableTextSearchPath above) into one combined property instead - sh:path an
 * sh:alternativePath across all of their predicates, explicitly tagged st:facet st:TextSearchFacet
 * - so free-text search happens once, across every such field at once, rather than one separate
 * search box per plain string/langString property. A property already given its own st:facet
 * (including TextSearchFacet itself) is left exactly as it was; it just isn't folded into the
 * combined one.
 *
 * Each merged property's own (rootShape, sh:property, propertyNode) link is removed - not just
 * left alongside the new combined one - since it's now represented only there; its own other
 * triples (sh:path, sh:datatype, ...) are left in the graph, orphaned but harmless.
 *
 * sh:name is set directly (English/Dutch, the two locales this package ships) since
 * PropertyUIElement.label() has no single terminal predicate to fall back to for an
 * sh:alternativePath (see terminalPredicate()) - without it the facet would otherwise label itself
 * with the generated property shape's own blank node id.
 *
 * Copies shapesGraph into a fresh RdfStore first, same non-mutating reasoning as addMissingShapes
 * above. Runs after addMissingShapes, so a class that arrived at facet mode with literally no
 * shape at all still gets a real (implicit-class) root shape whose addMissingShapes-minted bare
 * properties (no sh:datatype at all) simply don't qualify here either - this preprocessor only
 * ever touches properties that do declare sh:datatype.
 */
export const mergeFacetTextSearchProperties: Preprocessor = (environment) => {
  if (environment.mode !== "facet" || !environment.enableFacetTextSearchMerging) return environment;

  const shapesGraph = RdfStore.createDefault();
  for (const quad of (environment.shapesGraph as RdfStore).getQuads()) shapesGraph.addQuad(quad);

  for (const rootShape of facetableRootShapes(shapesGraph)) {
    const toMerge: { link: Quad; path: NamedNode }[] = [];
    for (const link of shapesGraph.getQuads(rootShape, sh("property"))) {
      const path = mergeableTextSearchPath(link.object, shapesGraph);
      if (path) toMerge.push({ link, path });
    }
    if (toMerge.length === 0) continue;

    for (const { link } of toMerge) shapesGraph.removeQuad(link);

    const listHead = rebuildRdfList(rdf("nil"), toMerge.map((entry) => entry.path), shapesGraph);
    const alternativePathNode = factory.blankNode();
    shapesGraph.addQuad(factory.quad(alternativePathNode, sh("alternativePath"), listHead as Quad_Object));

    const propertyNode = factory.blankNode();
    shapesGraph.addQuad(factory.quad(propertyNode, sh("path"), alternativePathNode));
    shapesGraph.addQuad(factory.quad(propertyNode, sh("name"), factory.literal("Search", "en")));
    shapesGraph.addQuad(factory.quad(propertyNode, sh("name"), factory.literal("Zoeken", "nl")));
    shapesGraph.addQuad(factory.quad(propertyNode, st("facet"), st("TextSearchFacet")));
    shapesGraph.addQuad(factory.quad(rootShape, sh("property"), propertyNode));
  }

  return { ...environment, shapesGraph };
};
