import type { Literal, NamedNode, Quad, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import type { Preprocessor } from "@/preprocess/index.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, rdfs, sh, st, xsd } from "@/helpers/namespaces.ts";
import { getRdfList, rebuildRdfList } from "@/helpers/rdfList.ts";
import { termKey } from "@/helpers/termKey.ts";
import {
  facetableRootShapes,
  shapesForClass,
  withSuperClassShapes,
} from "@/resolution/targets.ts";

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

// Every predicate already declared via a plain sh:property/sh:path on any shape node in
// `shapeNodes` (shapesForClass's own result for a class) OR on a shape reachable from one of
// them via sh:and/sh:node, plus every predicate any of those shape nodes lists under
// sh:ignoredProperties (7.9.1's sh:closed companion - a shape author explicitly declaring a
// predicate as ignored is declaring it out of scope for that shape just as deliberately as
// declaring it via sh:property, so it must not get a synthesized bare property either). The
// sh:and/sh:node recursion (with a `visited` cycle guard, same shape graph acyclic-by-assumption
// as childrenForShape.ts) mirrors childrenForShape.ts's own walk exactly: that's what actually
// renders a node shape's properties, flattening any sh:and/sh:node-referenced shape's sh:property
// entries into the same focus node - so a predicate only covered through a referenced shape (e.g.
// a shared "NamedThingShape" pulled in via sh:node for shape composition) still counts as covered
// here, rather than getting a redundant, unlabeled bare property minted alongside the real one.
// A plain NamedNode path counts directly; an sh:alternativePath also counts, one predicate per
// plain-NamedNode branch (e.g. mergeFacetTextSearchProperties's own generated
// `sh:alternativePath (dc:title rdfs:label)` shape below) - a predicate already reachable through
// one branch of an existing alternative doesn't need a redundant bare property of its own. Any other
// compound path (a sequence, inverse, zeroOrMore, ...) still isn't recognized as covered here,
// matching predicatesUsedByInstancesOf's own predicate-only granularity - a predicate only reachable
// that way could still get a redundant bare property minted alongside it. That's acceptable:
// sh:property entries are conjunctive, not exclusive, so a false "still missing" call just adds a
// harmless duplicate field rather than breaking anything.
function predicatesCoveredByShapeNodes(
  shapeNodes: Quad_Subject[],
  shapesGraph: RdfStore,
): Set<string> {
  const covered = new Set<string>();
  const visited = new Set<string>();

  function walk(shapeNode: Term): void {
    const key = termKey(shapeNode);
    if (visited.has(key)) return;
    visited.add(key);

    for (const propertyLink of shapesGraph.getQuads(shapeNode, sh("property"))) {
      const pathQuad = shapesGraph.getQuads(propertyLink.object, sh("path"))[0];
      if (!pathQuad) continue;
      if (pathQuad.object.termType === "NamedNode") {
        covered.add(pathQuad.object.value);
        continue;
      }
      const alternativePathQuad = shapesGraph.getQuads(pathQuad.object, sh("alternativePath"))[0];
      if (!alternativePathQuad) continue;
      for (const branch of expandListOrTerm(alternativePathQuad.object, shapesGraph)) {
        if (branch.termType === "NamedNode") covered.add(branch.value);
      }
    }
    for (const ignoredQuad of shapesGraph.getQuads(shapeNode, sh("ignoredProperties"))) {
      for (const ignored of expandListOrTerm(ignoredQuad.object, shapesGraph)) {
        if (ignored.termType === "NamedNode") covered.add(ignored.value);
      }
    }

    for (const listQuad of shapesGraph.getQuads(shapeNode, sh("and"))) {
      for (const branchShape of getRdfList(listQuad.object, shapesGraph)) walk(branchShape);
    }
    for (const nodeQuad of shapesGraph.getQuads(shapeNode, sh("node"))) walk(nodeQuad.object);
  }

  for (const shapeNode of shapeNodes) walk(shapeNode);
  return covered;
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

// Every object value dataGraph actually holds for `predicate` on any of dataGraph's own instances
// of `classIri` - the same instance walk predicatesUsedByInstancesOf does, just collecting values
// for one already-known-missing predicate instead of discovering predicates in the first place.
function valuesUsedFor(
  classIri: NamedNode,
  predicate: NamedNode,
  dataGraph: RdfStore,
): Quad_Object[] {
  const values: Quad_Object[] = [];
  for (const { subject: instance } of dataGraph.getQuads(null, rdf("type"), classIri)) {
    for (const quad of dataGraph.getQuads(instance, predicate)) {
      values.push(quad.object);
    }
  }
  return values;
}

// SHACL's three leaf node kinds (7.7.1's compound BlankNodeOrIRI/BlankNodeOrLiteral/IRIOrLiteral
// are for genuinely mixed data, not synthesized here) keyed by the RDF/JS termType that maps to
// each one.
const nodeKindByTermType: Partial<Record<Term["termType"], NamedNode>> = {
  NamedNode: sh("IRI"),
  BlankNode: sh("BlankNode"),
  Literal: sh("Literal"),
};

// Every rdf:type value dataGraph gives `value` - used only to look for a class every value of a
// predicate agrees on (inferredConstraints below), so this is only ever consulted for a resource
// value (IRI or blank node); a Literal never reaches it.
function typesOf(value: Quad_Object, dataGraph: RdfStore): Set<string> {
  return new Set(dataGraph.getQuads(value, rdf("type")).map((quad) => quad.object.value));
}

// A generated property shape can safely take the liberty of a narrower sh:nodeKind/sh:datatype/
// sh:class than "anything goes" when every value dataGraph actually has for that predicate -
// across every instance of the class, not just one - already agrees: sh:nodeKind once every value
// shares the same RDF/JS termType; sh:datatype (literals only) once every value additionally
// shares the same literal datatype IRI (rdf:langString included, so an all-langString predicate
// still gets one); sh:class (IRIs/blank nodes only) once every value shares exactly one rdf:type
// in dataGraph in common. A predicate with no values yet, a genuinely mixed one (an IRI here, a
// literal there), or resource values whose rdf:type sets don't all agree on a single class, gets
// none of these - no false narrowing of data that hasn't actually settled on one shape. When
// several values happen to share more than one rdf:type in common (e.g. every value is both
// ex:Cat and ex:Pet), no single one is picked automatically either - guessing which of several
// equally-true classes the shape author actually meant would be a real assertion, not just
// restating what the data already shows.
function inferredConstraints(
  values: Quad_Object[],
  dataGraph: RdfStore,
): { nodeKind?: NamedNode; datatype?: NamedNode; classIri?: NamedNode } {
  const [first, ...rest] = values;
  if (!first || !rest.every((value) => value.termType === first.termType)) return {};

  const nodeKind = nodeKindByTermType[first.termType];
  if (!nodeKind) return {};

  if (first.termType === "Literal") {
    const literals = values as Literal[];
    const datatype = literals[0].datatype;
    const sameDatatype = literals.every((literal) => literal.datatype.equals(datatype));
    return sameDatatype ? { nodeKind, datatype } : { nodeKind };
  }

  const [firstTypes, ...restTypes] = values.map((value) => typesOf(value, dataGraph));
  const commonTypes = restTypes.reduce(
    (common, types) => new Set([...common].filter((type) => types.has(type))),
    firstTypes,
  );
  return commonTypes.size === 1
    ? { nodeKind, classIri: factory.namedNode([...commonTypes][0]) }
    : { nodeKind };
}

/**
 * Opt-in (Environment.enableMissingShapesGeneration, off by default) shape inference: for every
 * class found via rdf:type anywhere in dataGraph, tops up one bare sh:property/sh:path for each
 * predicate actually used by that class's own instances that isn't already covered by any shape
 * node already targeting the class (shapesForClass/predicatesCoveredByShapeNodes) - this is a
 * per-predicate gap-fill, not an all-or-nothing "does this class have a shape at all" check: a
 * class with an existing-but-incomplete shape still gets its missing predicates added, right onto
 * that same existing shape node, so data that's only partially shaped still renders every field
 * it actually carries, not just the ones the shape author happened to declare.
 *
 * A predicate listed under any of those shape nodes' own sh:ignoredProperties is treated as
 * covered too, not just "still missing" - sh:ignoredProperties is how a shape author says a
 * predicate is deliberately out of scope for this shape (typically alongside sh:closed), so
 * synthesizing a bare property for it here would defeat that authorial intent.
 *
 * When a class has no shape at all yet, one is minted first: the generated shape's own subject is
 * `classIri` itself, typed both sh:NodeShape and rdfs:Class - 3.1.3.3's "implicit class target"
 * pattern, already recognized everywhere else in this codebase that resolves targets
 * (resolution/targets.ts's targetsOfShape, facetableRootShapes) - rather than a fresh
 * sh:targetClass-pointing blank/synthetic node. This makes the generated shape's identity
 * predictable: a caller who already knows the class IRI (e.g. to set Environment.nodeShapes) can
 * reference it directly, with no need to inspect the generated shapesGraph first to find an opaque
 * generated id. When the class already has at least one shape node, the missing properties are
 * attached to the first one shapesForClass finds instead, so an existing shape's own
 * identity/groups/etc are left completely untouched - only the properties it's missing are added.
 *
 * Deliberately minimal beyond that: a generated property shape carries no sh:name/sh:maxCount/
 * etc, so widget scoring falls back to its own generic-value heuristics the same as it would for
 * any other under-specified property shape - this is a fallback for unshaped/under-shaped data,
 * not a replacement for actually authoring a shape. The one liberty taken is sh:nodeKind/
 * sh:datatype/sh:class (inferredConstraints above): when every value the predicate actually has
 * across every instance of the class already agrees on a termType (and, for literals, a datatype;
 * for IRIs/blank nodes, one single common rdf:type), that much is safe to state outright rather
 * than leaving it generic - it narrows widget scoring (e.g. towards an IRI- or literal-specific
 * widget, or one aware of the value's class) without asserting anything the data doesn't already
 * show. A predicate with no values yet, genuinely mixed ones, or resource values that don't agree
 * on a single class, gets none of these.
 *
 * Copies shapesGraph into a fresh RdfStore rather than mutating the caller-supplied one in place -
 * shapesGraph is frequently a shared, module-level fixture reused across multiple
 * stories/renders/tests, so mutating it directly would leak generated shapes into unrelated runs.
 *
 * Runs after resolveRdfSources (so both graphs are resolved RdfStores, even though RawEnvironment's
 * type still allows an unresolved RdfSource). Widget scoring evaluates property shapes per property
 * at render time (scoring/score.ts), not in a preprocessing pass, so shapes minted here are scored
 * exactly like author-written ones.
 */
export const addMissingShapes: Preprocessor = (environment) => {
  if (!environment.enableMissingShapesGeneration) return environment;

  const dataGraph = environment.dataGraph as RdfStore;

  const shapesGraph = RdfStore.createDefault();
  for (const quad of (environment.shapesGraph as RdfStore).getQuads()) {
    shapesGraph.addQuad(quad);
  }

  for (const classIri of classesUsedInData(dataGraph)) {
    const shapeNodes = shapesForClass(classIri, shapesGraph);
    const coveredPredicates = predicatesCoveredByShapeNodes(shapeNodes, shapesGraph);

    const predicates = predicatesUsedByInstancesOf(classIri, dataGraph).filter(
      (predicate) => !coveredPredicates.has(predicate.value),
    );
    if (predicates.length === 0) continue;

    let targetShapeNode: Quad_Subject | undefined = shapeNodes[0];
    if (!targetShapeNode) {
      shapesGraph.addQuad(factory.quad(classIri, rdf("type"), sh("NodeShape")));
      shapesGraph.addQuad(factory.quad(classIri, rdf("type"), rdfs("Class")));
      targetShapeNode = classIri;
    }

    for (const predicate of predicates) {
      const propertyNode = factory.blankNode();
      shapesGraph.addQuad(factory.quad(propertyNode, sh("path"), predicate));

      const { nodeKind, datatype, classIri: valueClass } = inferredConstraints(
        valuesUsedFor(classIri, predicate, dataGraph),
        dataGraph,
      );
      if (nodeKind) shapesGraph.addQuad(factory.quad(propertyNode, sh("nodeKind"), nodeKind));
      if (datatype) shapesGraph.addQuad(factory.quad(propertyNode, sh("datatype"), datatype));
      if (valueClass) shapesGraph.addQuad(factory.quad(propertyNode, sh("class"), valueClass));

      shapesGraph.addQuad(factory.quad(targetShapeNode, sh("property"), propertyNode));
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

/**
 * Expands `nodeShapes` with the shapes of every superclass of a class they cover (see
 * resolution/targets.ts's withSuperClassShapes), so naming only the most specific shape - e.g.
 * ManagerShape for a Manager ⊑ Employee ⊑ Person chain - still renders Employee's and Person's
 * fields too. Runs after addMissingShapes so a minted class-shape participates as well. Facet mode
 * has no focus node and treats nodeShapes as an allow-list instead, so it's left untouched there.
 */
export const addSuperClassShapes: Preprocessor = (environment) => {
  if (environment.mode === "facet" || environment.nodeShapes.length === 0) return environment;
  return {
    ...environment,
    nodeShapes: withSuperClassShapes(
      environment.nodeShapes,
      environment.shapesGraph as RdfStore,
      environment.dataGraph as RdfStore,
    ),
  };
};
