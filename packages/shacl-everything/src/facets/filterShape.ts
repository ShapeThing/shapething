import type { NamedNode, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { Engine as ShaclEngine } from "shacl-engine";
import { constraints as sparqlConstraints, functions as sparqlFunctions } from "shacl-engine/sparql.js";
import { sparqlFilterForBucket, type ColorBucket } from "@/helpers/colorBuckets.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { geosparqlExtensionFunctions } from "@/helpers/geosparqlFunctions.ts";
import { queryPrefixes, rdf, sh, st, xsd } from "@/helpers/namespaces.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
import { termKey } from "@/helpers/termKey.ts";
import { collectClassAndSubClasses } from "@/structure/classHierarchy.ts";
import { parsePropertyPath, type PropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import { writePropertyPath } from "@/structure/paths/writePropertyPath.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";

/**
 * The generated SHACL shape facet mode builds up as the user interacts with facets: one synthetic
 * root NodeShape (`rootNode`), with one sh:property child per property a facet has actually
 * written a constraint for. `store` is reactive (see helpers/reactiveRdfStore.ts) so
 * modes/facet/index.tsx's "live" facetChangeMode can subscribe to it - and hand it to
 * Environment.onSubmit, the same callback edit mode uses - exactly the way
 * ValidationContextProvider subscribes to dataGraph.
 *
 * `rootNode` is always a NamedNode (not a blank node) - the generated shape is meant to be handed
 * off to something else (e.g. shape-t-query) that will want a real IRI to refer to it by.
 */
export type FilterShape = { store: RdfStore; rootNode: NamedNode };

/**
 * `rootIri`, when given, becomes the generated shape's own identity - typically
 * Environment.focusNode, when an embedder has a real IRI in mind for it (see
 * modes/facet/index.tsx). Without one, a fresh `urn:uuid:` is minted instead, so the returned
 * shape always has *some* stable IRI rather than an anonymous blank node.
 */
export function createFilterShape(rootIri?: NamedNode): FilterShape {
  const store = makeReactive(RdfStore.createDefault());
  const rootNode = rootIri ?? factory.namedNode(`urn:uuid:${crypto.randomUUID()}`);
  store.addQuad(factory.quad(rootNode, rdf("type"), sh("NodeShape")));
  return { store, rootNode };
}

/**
 * `property`'s own path, canonically rendered (toSparql) so it's directly comparable to another
 * property's path regardless of which shapes/store it was parsed from - the same canonical-path
 * comparison propertiesForShape uses to group co-path property shapes. `undefined` when the
 * property has no sh:path at all.
 */
export function pathSparqlFor(property: PropertyUIElement): string | undefined {
  const path = parsePropertyPath(property.propertyShapes[0], property.shapesGraph);
  return path ? toSparql(path) : undefined;
}

/**
 * Finds the sh:property blank node on `filterShape` that already holds constraints for
 * `property`'s own path (compared canonically, same as propertiesForShape's own co-path grouping)
 * - a pure lookup, never writes to `filterShape.store`. `undefined` when no facet has written a
 * constraint for this path yet - the read-side counterpart to getFilterConstraintNode, used by a
 * facet's own getConstraint so simply rendering a facet (with no input given) never creates a
 * sh:property/sh:path entry (see FacetModeWrapper/FacetPropertyComponent for why that matters: a
 * live-submitted filterShape must only ever describe constraints the user actually asked for).
 */
export function findFilterConstraintNode(
  filterShape: FilterShape,
  property: PropertyUIElement,
): Quad_Subject | undefined {
  const { store, rootNode } = filterShape;
  const sparqlPath = pathSparqlFor(property);
  if (sparqlPath === undefined) return undefined;

  return store
    .getQuads(rootNode, sh("property"))
    .map((quad) => quad.object as Quad_Subject)
    .find((propertyNode) => {
      const existingPath = parsePropertyPath(propertyNode, store);
      return existingPath !== null && toSparql(existingPath) === sparqlPath;
    });
}

/**
 * Finds (via findFilterConstraintNode) or auto-vivifies the sh:property blank node on
 * `filterShape` that holds constraints for `property`'s own path. The first call for a given path
 * deep-copies the source property shape's own sh:path structure (via writePropertyPath, so a
 * compound path like sh:alternativePath carries over faithfully) and attaches the new node to the
 * root via sh:property; a later call for the same path returns the same node rather than creating
 * a duplicate sh:property entry.
 *
 * Only call this at the moment a facet is actually about to write a value (i.e. from inside
 * setConstraint, never from a render-time useMemo) - it unconditionally creates the node, so
 * calling it just to render/read a facet's current state would auto-vivify a property path before
 * any input was given. Reading current state should go through findFilterConstraintNode instead.
 *
 * A brand-new node's own sh:path is written *before* it's linked to `rootNode` via sh:property, not
 * after - a reactive reader (findFilterConstraintNode-based, see FacetPropertyComponent) is
 * watching for exactly that sh:property link to show up, and it must never observe a linked-but-
 * still-empty node. See setFilterConstraintForProperty's own doc comment for why this matters in
 * practice: writing a facet's very first value goes through that function, not this one directly.
 */
export function getFilterConstraintNode(
  filterShape: FilterShape,
  property: PropertyUIElement,
): Quad_Subject {
  const existing = findFilterConstraintNode(filterShape, property);
  if (existing) return existing;

  const { store, rootNode } = filterShape;
  const sourcePropertyShape = property.propertyShapes[0];
  const path = parsePropertyPath(sourcePropertyShape, property.shapesGraph);

  const propertyNode = factory.blankNode();
  if (path) {
    store.addQuad(
      factory.quad(propertyNode, sh("path"), writePropertyPath(path, store) as Quad_Object),
    );
  }
  copyRootClass(property, propertyNode, store);
  store.addQuad(factory.quad(rootNode, sh("property"), propertyNode));
  return propertyNode;
}

/**
 * Carries `property`'s own sh:rootClass (see shui:SubClassEditor/st:SubClassFacet) over onto the
 * generated filter constraint node, the same way the path itself is copied. sh:rootClass is a real
 * SHACL 1.2 Core constraint (spec §7.9.4, see stories/specifications/SHACL core 1.2/7.9.4* -
 * `RootClassConstraintComponent` in shacl-engine's own constraint set) requiring a value to be
 * rootClass itself or one of its rdfs:subClassOf descendants - exactly the "Electronics should also
 * match Computers, a subclass" hierarchy-aware behavior a class-taxonomy pick needs, so
 * buildEngineValidationShape below can hand this straight to a real shacl-engine validation pass
 * with no bespoke matching logic of its own, and the shape modes/facet/index.tsx eventually submits
 * stays a real, externally-reproducible SHACL constraint rather than a ShapeThing-only convention.
 */
function copyRootClass(
  property: PropertyUIElement,
  propertyNode: Quad_Subject,
  store: RdfStore,
): void {
  const rootClass = property.get(sh("rootClass"))[0];
  if (rootClass?.termType === "NamedNode") {
    store.addQuad(factory.quad(propertyNode, sh("rootClass"), rootClass));
  }
}

/**
 * The combined find-or-create-and-write every facet widget's own setConstraint(s) should call,
 * instead of calling getFilterConstraintNode then setFilterConstraint as two separate steps.
 *
 * The difference matters under React: filterShape.store is reactive (helpers/reactiveRdfStore.ts),
 * and a facet's own live read is a useSyncExternalStore subscription (useReactiveRead). Every
 * sibling facet watches the same wildcard rootNode/sh:property pattern (to notice a completely new
 * constraint appearing anywhere), so if getFilterConstraintNode's create branch linked a brand-new,
 * still-empty node into rootNode *before* every one of `entries` got a chance to write its value,
 * useSyncExternalStore's own dirty-check would read-and-cache (via useReactiveRead's `cache.current`)
 * a property with only *some* of its values written - a checkbox that doesn't reflect its own click,
 * a search box or price range that doesn't pick up its own first keystroke. Critically, that
 * dirty-check recompute also re-tracks the read against the now-existing node itself (no longer the
 * wildcard), so a *separate*, later write to that same node - e.g. a second, independent call to
 * this function for one more predicate - lands in the store correctly but is never observed by that
 * already-cached, already-stale reactive read: nothing re-invalidates it, since the wildcard pattern
 * it was originally watching no longer applies and the write happened before any subscriber started
 * watching the node itself. This is why ColorFacet writes its own sh:minInclusive *and*
 * sh:maxExclusive as one call to this function (via `entries`) rather than two separate calls -
 * two brand-new-node writes in the same tick would otherwise race exactly like that.
 *
 * This writes a brand-new node's own sh:path and every one of `entries`' values *before* linking it
 * to rootNode, so the one write any sibling's wildcard pattern can actually observe already
 * describes the complete constraint. An already-existing node (found via findFilterConstraintNode)
 * has no such race - it's already linked and already being watched via its own subject-wildcard
 * pattern - so each entry is just handed straight to setFilterConstraint.
 */
export function setFilterConstraintsForProperty(
  filterShape: FilterShape,
  property: PropertyUIElement,
  entries: ReadonlyArray<readonly [NamedNode, Term | Term[] | undefined]>,
): void {
  const existing = findFilterConstraintNode(filterShape, property);
  if (existing) {
    for (const [predicate, value] of entries) {
      setFilterConstraint(filterShape, existing, predicate, value, property.shapesGraph);
    }
    return;
  }

  const nonEmptyEntries = entries.filter(
    ([, value]) => !(value === undefined || (Array.isArray(value) && value.length === 0)),
  );
  if (nonEmptyEntries.length === 0) return;

  const { store, rootNode } = filterShape;
  const path = parsePropertyPath(property.propertyShapes[0], property.shapesGraph);

  const propertyNode = factory.blankNode();
  if (path) {
    store.addQuad(
      factory.quad(propertyNode, sh("path"), writePropertyPath(path, store) as Quad_Object),
    );
  }
  copyRootClass(property, propertyNode, store);
  for (const [predicate, value] of nonEmptyEntries) {
    setFilterConstraint(filterShape, propertyNode, predicate, value, property.shapesGraph);
  }
  store.addQuad(factory.quad(rootNode, sh("property"), propertyNode));
}

/** setFilterConstraintsForProperty for the common case of writing just one predicate. */
export function setFilterConstraintForProperty(
  filterShape: FilterShape,
  property: PropertyUIElement,
  predicate: NamedNode,
  value: Term | Term[] | undefined,
): void {
  setFilterConstraintsForProperty(filterShape, property, [[predicate, value]]);
}

/**
 * Replaces (or, when `value` is `undefined` or `[]`, removes) `constraintNode`'s current value(s)
 * for `predicate` - the write side a facet widget calls through FacetWidgetProps.setConstraint.
 * `value` as an array always writes a SHACL/RDF list (e.g. sh:in - even a single-member list stays
 * a list); a single Term always writes a plain triple (e.g. sh:minInclusive/sh:pattern).
 *
 * `existingHead` - the old value, whatever it was - is always run through rebuildRdfList, even
 * when the new value isn't an array (or is undefined/`[]`): rebuildRdfList's own delete-then-build
 * pass is what actually removes a list's rdf:first/rdf:rest cells, not the plain removeQuad loop
 * above (which only ever drops the constraintNode -> predicate -> listHead link itself) - it's a
 * harmless no-op whenever `existingHead` was never a list head to begin with (a plain literal/IRI
 * value, or no previous value at all). Skipping this whenever the new value was empty used to leave
 * the old list's cells orphaned in the store forever.
 *
 * Once the write is done, if `constraintNode` no longer carries any constraint predicate (only its
 * own sh:path is left - e.g. the last checkbox in a category facet was just unchecked), the whole
 * sh:property entry is pruned back out via removeFilterConstraintsForPaths's same
 * deleteBlankNodeClosure cleanup - mirroring getFilterConstraintNode's auto-vivify on the way in,
 * so a facet with no value given (not even one it had earlier but cleared) never leaves a vacuous
 * sh:property/sh:path entry behind in what modes/facet/index.tsx submits.
 *
 * `shapesGraph`, when given, is only ever consulted for an sh:in write on a node that also carries
 * sh:rootClass (see syncRootClassSparqlConstraint) - every other predicate ignores it, and callers
 * with no class-taxonomy facet in play (most of filterShape.test.ts's direct calls) can omit it.
 */
export function setFilterConstraint(
  filterShape: FilterShape,
  constraintNode: Quad_Subject,
  predicate: NamedNode,
  value: Term | Term[] | undefined,
  shapesGraph?: RdfStore,
): void {
  const { store, rootNode } = filterShape;
  const existingQuads = store.getQuads(constraintNode, predicate);
  const existingHead = existingQuads[0]?.object;

  for (const quad of existingQuads) store.removeQuad(quad);

  const listHead = rebuildRdfList(
    existingHead ?? rdf("nil"),
    Array.isArray(value) ? value : [],
    store,
  );
  if (Array.isArray(value)) {
    if (value.length > 0) {
      store.addQuad(factory.quad(constraintNode, predicate, listHead as Quad_Object));
    }
  } else if (value !== undefined) {
    store.addQuad(factory.quad(constraintNode, predicate, value as Quad_Object));
  }

  if (predicate.equals(st("withinArea"))) {
    syncWithinAreaSparqlConstraint(store, constraintNode, Array.isArray(value) ? undefined : value);
  }
  if (predicate.equals(st("colorBucket"))) {
    syncColorBucketSparqlConstraint(store, constraintNode, Array.isArray(value) ? undefined : value);
  }
  if (predicate.equals(sh("in")) && shapesGraph) {
    syncRootClassSparqlConstraint(store, constraintNode, shapesGraph);
  }

  const stillHasConstraint = store
    .getQuads(constraintNode)
    .some((quad) => !quad.predicate.equals(sh("path")));
  if (stillHasConstraint) return;

  const propertyQuad = store.getQuads(rootNode, sh("property"), constraintNode)[0];
  if (!propertyQuad) return;
  store.removeQuad(propertyQuad);
  deleteBlankNodeClosure(store, constraintNode);
}

// Minimal SPARQL string-literal escaping for a value about to be spliced into generated query text
// - mirrors outputs/render/hooks/query.ts's own escapeSparqlLiteral (kept as a separate copy rather
// than a shared import: that module is the outputs/render/ Comunica-facing layer, this one is the
// framework-agnostic structure/ layer, and neither should depend on the other for a three-line
// string escape).
function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Keeps constraintNode's own sh:sparql [ a sh:SPARQLConstraint ; sh:select "..." ] entry in sync
 * with its st:withinArea value (see setFilterConstraint above) - a real, standards-conformant SHACL
 * "SPARQL-based Constraint" (SHACL Core §3.5), built from the geof:sfWithin GeoSPARQL extension
 * function (see helpers/geosparqlFunctions.ts, registered on the Comunica engine in
 * outputs/render/hooks/query.ts), so an external SHACL-SPARQL-aware consumer of the shape this
 * renderer submits (e.g. shape-t-query, or any conformant SPARQL-based-constraints engine) can
 * enforce the exact same spatial rule without ever knowing ShapeThing's own st:withinArea
 * vocabulary. st:withinArea itself is left untouched by this function - it stays the plain value
 * facetValues.ts's countFacetInstancesWithinArea reads directly for a single facet's own displayed
 * match count - re-deriving the drawn area from generated SPARQL text on every facet-count read
 * would be needless, fragile work for a value already sitting right there as a literal.
 *
 * Always regenerates from scratch (delete-then-rebuild, like rebuildRdfList) rather than trying to
 * patch the previous sh:select text in place - MapFacet re-calls this on every drawn-shape change
 * (and its own 400ms poll - see widget.tsx), so there's no meaningful "diff" to preserve, only a
 * current value to reflect.
 *
 * The generated query uses FILTER NOT EXISTS (the spec-correct, portable "for-all" shape - $this
 * violates unless *some* value satisfies geof:sfWithin) rather than a MINUS-based rewrite - this
 * exact text is still never run by this renderer's own matching (instancesMatchingOtherConstraints
 * routes st:withinArea through matchingInstancesWithinArea's own positive-form query instead, for
 * exactly the reason below), only kept here for an external SHACL-SPARQL-aware consumer. Comunica
 * 4.5 does *not* correctly correlate $this into a FILTER NOT EXISTS pattern when a custom extension
 * function (like geof:sfWithin) sits inside it: the nested pattern resolves against the wrong outer
 * binding regardless of which $this is active (verified against a minimal repro outside this
 * codebase) - shacl-engine's own sh:sparql support runs through that same Comunica engine, so
 * running this exact text through it for real would silently misclassify results, not just work.
 * A MINUS-based rewrite correlates correctly under Comunica, but silently drops the "zero values
 * for the path is also a violation" case (MINUS needs $this to already join through at least one
 * value to appear as a row at all) - not a safe substitute, just a different bug, and irrelevant to
 * an external consumer that isn't necessarily Comunica-backed at all.
 */
function syncWithinAreaSparqlConstraint(
  store: RdfStore,
  constraintNode: Quad_Subject,
  area: Term | undefined,
): void {
  const existingSparqlQuad = store.getQuads(constraintNode, sh("sparql"))[0];
  if (existingSparqlQuad) {
    store.removeQuad(existingSparqlQuad);
    deleteBlankNodeClosure(store, existingSparqlQuad.object);
  }

  if (!area || area.termType !== "Literal") return;
  const path = parsePropertyPath(constraintNode, store);
  if (!path) return;

  const sparqlNode = factory.blankNode();
  store.addQuad(factory.quad(sparqlNode, rdf("type"), sh("SPARQLConstraint")));
  store.addQuad(
    factory.quad(
      sparqlNode,
      sh("select"),
      factory.literal(
        `${queryPrefixes}\nselect $this where { filter not exists { $this ${toSparql(path)} ?withinAreaValue . filter(geof:sfWithin(?withinAreaValue, "${escapeSparqlLiteral(area.value)}"^^<${area.datatype.value}>)) } }`,
      ),
    ),
  );
  store.addQuad(factory.quad(constraintNode, sh("sparql"), sparqlNode as Quad_Object));
}

/**
 * Keeps constraintNode's own sh:sparql [ a sh:SPARQLConstraint ; sh:select "..." ] entry in sync
 * with its st:colorBucket value (see setFilterConstraint above) - the same "bespoke value for
 * ColorFacet's own widget display, standards-form SPARQL text for actual matching" split
 * syncWithinAreaSparqlConstraint above uses for MapFacet's st:withinArea. st:colorBucket itself is
 * left untouched by this function - it stays the plain bucket-name literal ColorFacet's own
 * widget.tsx reads directly to reclassify each candidate's own HSL for its swatch UI - re-deriving
 * the bucket from generated SPARQL text there would be needless, fragile work for a value already
 * sitting right there as a literal. instancesConformingViaEngine is what actually matches on this
 * predicate, by running this sh:sparql for real (unlike its st:withinArea sibling above, this query
 * has no custom extension function inside its FILTER NOT EXISTS, so it doesn't hit the Comunica
 * correlation bug and is safe to run through shacl-engine as-is).
 *
 * The generated query reads a value's st:hue/st:saturation/st:lightness directly and applies
 * helpers/colorBuckets.ts's sparqlFilterForBucket - the SPARQL-text counterpart of the same
 * classifyHsl cascade bucketForHsl uses in JS - inside the same portable FILTER NOT EXISTS "for-all"
 * shape syncWithinAreaSparqlConstraint's own doc comment explains (with the same Comunica
 * FILTER-NOT-EXISTS-plus-extension-function caveat not applying here, since this query uses only
 * plain SPARQL comparison operators, no extension function).
 */
function syncColorBucketSparqlConstraint(
  store: RdfStore,
  constraintNode: Quad_Subject,
  bucket: Term | undefined,
): void {
  const existingSparqlQuad = store.getQuads(constraintNode, sh("sparql"))[0];
  if (existingSparqlQuad) {
    store.removeQuad(existingSparqlQuad);
    deleteBlankNodeClosure(store, existingSparqlQuad.object);
  }

  if (!bucket || bucket.termType !== "Literal") return;
  const path = parsePropertyPath(constraintNode, store);
  if (!path) return;

  const filter = sparqlFilterForBucket(bucket.value as ColorBucket);
  const sparqlNode = factory.blankNode();
  store.addQuad(factory.quad(sparqlNode, rdf("type"), sh("SPARQLConstraint")));
  store.addQuad(
    factory.quad(
      sparqlNode,
      sh("select"),
      factory.literal(
        `${queryPrefixes}\nselect $this where { filter not exists { $this ${toSparql(path)} ?colorValue . ?colorValue st:hue ?hue ; st:saturation ?sat ; st:lightness ?light . filter(${filter}) } }`,
      ),
    ),
  );
  store.addQuad(factory.quad(constraintNode, sh("sparql"), sparqlNode as Quad_Object));
}

/**
 * Keeps constraintNode's own sh:sparql [ a sh:SPARQLConstraint ; sh:select "..." ] entry in sync
 * with its sh:in value, for a class-taxonomy pick (sh:rootClass present - see copyRootClass): each
 * *chosen* sh:in value should also match its own subclasses, not just an exact-term match - a
 * category faceted as "Electronics" should still count a product tagged "Computers".
 *
 * This is deliberately not shacl-engine's own real sh:rootClass/RootClassConstraintComponent (SHACL
 * 1.2 Core §7.9.4, which copyRootClass's own sh:rootClass triple otherwise is): that constraint
 * checks a value against the *shape-declared* rootClass (e.g. ex:Category, the whole taxonomy's
 * root, written once by the shape author to tell SubClassFacet/SubClassEditor where their tree
 * starts - see structure/classHierarchy.ts), not against whichever *specific* node(s) the user
 * actually picked into sh:in (e.g. ex:Electronics). Those are different questions - "is this a
 * Category at all" vs "is this Electronics-or-a-subclass" - so running the real rootClass
 * constraint component here would validate the wrong thing (every product in the fixture is some
 * kind of Category, so it would never narrow anything). buildEngineValidationShape drops both
 * sh:in and sh:rootClass from what it actually validates whenever this sh:sparql exists, for
 * exactly this reason - this sh:sparql is the one real constraint that expresses "matches one of
 * the picks, or a descendant of one," and dropping sh:in is the same "AND with an unrelated
 * component would veto every subclass match" tradeoff already true when this was first written
 * around class-hierarchy sh:in (see buildEngineValidationShape's own doc comment for the details).
 *
 * The allowed-classes closure (collectClassAndSubClasses, over `shapesGraph`'s own rdfs:subClassOf
 * triples, one call per chosen value) is resolved once here, at write time, into a flat VALUES list
 * baked directly into the generated query text - not re-derived from a live subclass triple-walk at
 * validation time, since shapesGraph and dataGraph aren't guaranteed to be the same store a
 * SPARQL-based constraint would actually run against (see instancesConformingViaEngine, which
 * validates against dataGraph alone).
 */
function syncRootClassSparqlConstraint(
  store: RdfStore,
  constraintNode: Quad_Subject,
  shapesGraph: RdfStore,
): void {
  const existingSparqlQuad = store.getQuads(constraintNode, sh("sparql"))[0];
  if (existingSparqlQuad) {
    store.removeQuad(existingSparqlQuad);
    deleteBlankNodeClosure(store, existingSparqlQuad.object);
  }

  const rootClass = store.getQuads(constraintNode, sh("rootClass"))[0]?.object;
  const inQuad = store.getQuads(constraintNode, sh("in"))[0];
  const path = parsePropertyPath(constraintNode, store);
  if (!rootClass || rootClass.termType !== "NamedNode" || !inQuad || !path) return;

  const allowedClasses = new Set<string>();
  for (const term of expandListOrTerm(inQuad.object, store)) {
    if (term.termType !== "NamedNode") continue;
    for (const iri of collectClassAndSubClasses(shapesGraph, term)) allowedClasses.add(iri);
  }
  if (allowedClasses.size === 0) return;

  const valuesList = [...allowedClasses].map((iri) => `<${iri}>`).join(" ");
  const sparqlNode = factory.blankNode();
  store.addQuad(factory.quad(sparqlNode, rdf("type"), sh("SPARQLConstraint")));
  store.addQuad(
    factory.quad(
      sparqlNode,
      sh("select"),
      factory.literal(
        `${queryPrefixes}\nselect $this where { filter not exists { $this ${toSparql(path)} ?rootClassValue . values ?rootClassValue { ${valuesList} } } }`,
      ),
    ),
  );
  store.addQuad(factory.quad(constraintNode, sh("sparql"), sparqlNode as Quad_Object));
}

/**
 * Removes every sh:property constraint node on `filterShape` whose own path (compared the same
 * canonical way as getFilterConstraintNode's lookup) is in `paths` - each a toSparql() string.
 * Used when the user switches facet mode's active root shape (see modes/facet/NodeUIComponent.tsx)
 * to drop constraints belonging only to the previously selected type, keeping the intersection: a
 * constraint whose path the newly selected type also has stays untouched.
 */
export function removeFilterConstraintsForPaths(
  filterShape: FilterShape,
  paths: ReadonlySet<string>,
): void {
  if (paths.size === 0) return;
  const { store, rootNode } = filterShape;

  for (const quad of store.getQuads(rootNode, sh("property"))) {
    const propertyNode = quad.object as Quad_Subject;
    const existingPath = parsePropertyPath(propertyNode, store);
    if (existingPath === null || !paths.has(toSparql(existingPath))) continue;

    store.removeQuad(quad);
    deleteBlankNodeClosure(store, propertyNode);
  }
}

// Copies every triple reachable from `term` through blank-node objects, source store to target
// store - buildEngineValidationShape's own "bring a constraint node's full description along, not
// just its direct quads" counterpart to deleteBlankNodeClosure's delete-shaped walk below (an
// sh:in's rdf:List cells, an sh:sparql node's own rdf:type/sh:select, are all reached this way).
function copyBlankNodeClosure(source: RdfStore, term: Term, target: RdfStore): void {
  if (term.termType !== "BlankNode") return;
  for (const quad of source.getQuads(term)) {
    target.addQuad(quad);
    copyBlankNodeClosure(source, quad.object, target);
  }
}

// Builds a throwaway SHACL shapes graph containing just `constraintNodes`, wired up under a fresh
// root NodeShape - the same sh:path/sh:in/sh:pattern/sh:minInclusive/... structure filterShape.store
// already holds for them, copied out (not validated against filterShape.store in place) so a
// class-hierarchy pick's own sh:in *and* sh:rootClass can both be dropped from what's actually
// validated whenever its sibling sh:sparql (syncRootClassSparqlConstraint) is present:
//
// - Plain sh:in means "exactly one of these terms" - keeping it alongside a sh:sparql that means
//   "one of these terms, or a descendant of one" would AND the two together, letting sh:in's
//   exact-match veto every subclass match the sh:sparql exists to allow (faceting "Electronics"
//   would then reject a "Computers"-tagged product again).
// - sh:rootClass is a real, different SHACL 1.2 Core constraint (§7.9.4,
//   RootClassConstraintComponent) that checks a value against the *shape-declared* taxonomy root
//   (e.g. ex:Category, written once so SubClassFacet/SubClassEditor know where their tree starts -
//   see structure/classHierarchy.ts) - not against whichever specific node(s) sh:in actually holds.
//   Every product in a typical taxonomy fixture *is* some kind of ex:Category, so leaving it in
//   would validate a real but unrelated question and narrow nothing.
//
// The real filterShape.store node is left untouched either way - FacetPropertyComponent's own
// getConstraint still reads sh:in straight off it for the widget's current-value display, and
// structure/classHierarchy.ts still reads sh:rootClass off it to render the taxonomy tree.
function buildEngineValidationShape(
  filterStore: RdfStore,
  constraintNodes: readonly Quad_Subject[],
): { shapeStore: RdfStore; validationRoot: NamedNode } {
  const shapeStore = RdfStore.createDefault();
  const validationRoot = factory.namedNode(`urn:uuid:${crypto.randomUUID()}`);
  shapeStore.addQuad(factory.quad(validationRoot, rdf("type"), sh("NodeShape")));

  for (const node of constraintNodes) {
    shapeStore.addQuad(factory.quad(validationRoot, sh("property"), node));
    const isClassHierarchyPick = filterStore.getQuads(node, sh("rootClass")).length > 0;
    let someValueShape: Quad_Subject | undefined;
    for (const quad of filterStore.getQuads(node)) {
      if (isClassHierarchyPick && (quad.predicate.equals(sh("in")) || quad.predicate.equals(sh("rootClass")))) {
        continue;
      }
      if (SOME_VALUE_PREDICATES.some((predicate) => predicate.equals(quad.predicate))) {
        if (!someValueShape) {
          someValueShape = factory.blankNode();
          shapeStore.addQuad(factory.quad(node, sh("qualifiedValueShape"), someValueShape));
          shapeStore.addQuad(
            factory.quad(node, sh("qualifiedMinCount"), factory.literal("1", xsd("integer"))),
          );
        }
        shapeStore.addQuad(factory.quad(someValueShape, quad.predicate, quad.object));
        copyBlankNodeClosure(filterStore, quad.object, shapeStore);
        continue;
      }
      shapeStore.addQuad(quad);
      copyBlankNodeClosure(filterStore, quad.object, shapeStore);
    }
  }
  return { shapeStore, validationRoot };
}

// Value-level constraints a facet means as "at least one value matches", not SHACL's own "every
// value matches" - TextSearchFacet's sh:pattern/sh:flags and a range facet's bounds. Plain SHACL
// would reject a chef whose sh:alternativePath-merged search (preprocess/shapes.ts's
// mergeFacetTextSearchProperties) matches schema:name but not schema:nationality, or a product with
// one price inside the range and one outside it. buildEngineValidationShape moves these into an
// sh:qualifiedValueShape with sh:qualifiedMinCount 1, the same "some value" semantics
// facets/facetValues.ts's countFacetInstancesMatchingPattern/countFacetInstancesInRange already
// use for the count badge - so the badge and the actual result list agree.
const SOME_VALUE_PREDICATES = [
  sh("pattern"),
  sh("flags"),
  sh("minInclusive"),
  sh("maxInclusive"),
  sh("minExclusive"),
  sh("maxExclusive"),
];

/**
 * `instances` narrowed to whichever conform to every one of `constraintNodes` via a real
 * shacl-engine validation pass - sh:in/sh:pattern+sh:flags/sh:minInclusive/.../sh:maxExclusive are
 * already native SHACL Core constraint components, and the class-hierarchy sh:in/st:colorBucket
 * cases are real SPARQL-based constraints (sh:sparql - see syncRootClassSparqlConstraint/
 * syncColorBucketSparqlConstraint), so there is nothing left here to hand-roll: shacl-engine (built
 * with shacl-engine/sparql.js's functions/constraints, the same way ValidationContextProvider's own
 * engine is) already means exactly what these predicates mean. Never called with a node carrying
 * st:withinArea - instancesMatchingOtherConstraints below routes that predicate through
 * matchingInstancesWithinArea instead (see that function's own doc comment for why).
 *
 * Built fresh per call rather than cached - filterShape.store's structure changes on every facet
 * click, so there's no stable shapes graph to compile an Engine against once the way
 * ValidationContextProvider caches one for a whole (read-only, unchanging) real shapesGraph - but
 * Engine construction itself is cheap and synchronous (it doesn't eagerly parse shapes; that's
 * lazy, per-validate-call work), so rebuilding one here isn't the cost that might suggest.
 *
 * A validation failure (a malformed sh:sparql body, say) is logged and treated as "no narrowing" -
 * `instances` unfiltered - rather than either throwing (taking down the whole facet UI over one bad
 * constraint) or excluding everything (which would look identical to "nothing matches" and hide the
 * actual problem worse).
 */
async function instancesConformingViaEngine(
  filterStore: RdfStore,
  dataGraph: RdfStore,
  constraintNodes: readonly Quad_Subject[],
  instances: Quad_Subject[],
): Promise<Quad_Subject[]> {
  if (constraintNodes.length === 0 || instances.length === 0) return instances;

  const { shapeStore, validationRoot } = buildEngineValidationShape(filterStore, constraintNodes);
  try {
    const engine = new ShaclEngine(shapeStore.asDataset(), {
      factory,
      functions: sparqlFunctions,
      constraints: sparqlConstraints,
    });
    const report = await engine.validate(
      { dataset: dataGraph.asDataset(), terms: instances },
      [{ terms: [validationRoot] }],
    );
    const violating = new Set(report.results.map((result) => termKey(result.focusNode.term)));
    return instances.filter((instance) => !violating.has(termKey(instance)));
  } catch (error) {
    console.warn("[shacl-everything] facet constraint validation failed:", error);
    return instances;
  }
}

// One Comunica engine for every st:withinArea narrowing query this module runs - separate from (not
// shared with) outputs/render/hooks/query.ts's own module-level engine, since importing that module
// here would run structure/ -> outputs/render/ -> structure/ in a circle (query.ts itself already
// imports structure/PropertyUIElement.ts/paths/toSparql.ts). Mirrors preprocess/ontologyLabels.ts's
// dereferenceMissingPropertyNames, which keeps its own separate lazily-imported/cached QueryEngine
// for exactly the same reason. Dynamically imported and cached so nothing pays for Comunica's
// SPARQL machinery until a map facet is actually in play.
let withinAreaEnginePromise: Promise<import("@comunica/query-sparql").QueryEngine> | undefined;
function getWithinAreaQueryEngine() {
  withinAreaEnginePromise ??= import("@comunica/query-sparql").then(
    ({ QueryEngine }) => new QueryEngine(),
  );
  return withinAreaEnginePromise;
}

/**
 * `instances` narrowed to whichever have at least one value for `path` falling inside `area` - the
 * st:withinArea half of instancesMatchingOtherConstraints, kept as a real, positive-form SPARQL
 * query run directly via Comunica rather than a SHACL SPARQLConstraint run through shacl-engine
 * (see syncWithinAreaSparqlConstraint's own doc comment): that constraint's generated text uses
 * FILTER NOT EXISTS with geof:sfWithin (a custom extension function) nested inside it, and
 * shacl-engine's own sh:sparql support runs through the same Comunica engine that pattern doesn't
 * correlate $this into correctly - silently wrong results, not just a slower path, if run for real
 * that way. This query sidesteps the bug entirely by asking the positive question directly (`?this
 * ?path ?value . filter(geof:sfWithin(?value, area))`, no nested EXISTS at all) instead of the
 * SHACL-SPARQL convention's "which focus nodes violate" negation - the same plain join+filter shape
 * every other geof: query in this codebase (searchInstances, shui:searchQuery) already relies on.
 *
 * Values are inlined into the query text as a `VALUES ?this { <iri> ... }` clause the same way
 * outputs/render/hooks/query.ts's buildRoleLookupQuery does, so this assumes every instance is a
 * NamedNode - true for every facetable root shape instance this codebase actually produces.
 */
async function matchingInstancesWithinArea(
  path: PropertyPath,
  area: Term,
  dataGraph: RdfStore,
  instances: Quad_Subject[],
): Promise<Quad_Subject[]> {
  if (instances.length === 0 || area.termType !== "Literal") return instances;

  const query = `${queryPrefixes}
select distinct ?this where {
  values ?this { ${instances.map((instance) => `<${instance.value}>`).join(" ")} }
  ?this ${toSparql(path)} ?value .
  filter(geof:sfWithin(?value, "${escapeSparqlLiteral(area.value)}"^^<${area.datatype.value}>))
}`;

  try {
    const engine = await getWithinAreaQueryEngine();
    const bindingsStream = await engine.queryBindings(query, {
      sources: [dataGraph],
      extensionFunctions: geosparqlExtensionFunctions,
    });
    const bindings = await bindingsStream.toArray();
    const matching = new Set(
      bindings
        .map((binding) => binding.get("this")?.value)
        .filter((value): value is string => value !== undefined),
    );
    return instances.filter((instance) => matching.has(instance.value));
  } catch (error) {
    console.warn("[shacl-everything] st:withinArea facet narrowing query failed:", error);
    return instances;
  }
}

/**
 * `instances` narrowed down to only the ones satisfying every *other* currently-active facet
 * constraint on `filterShape` - "other" meaning every sh:property entry except the one whose own
 * path equals `excludePath` (typically the facet asking the question, via pathSparqlFor - compare
 * `undefined` to exclude nothing). This is what makes a facet's own option/range counts (see
 * facets/facetValues.ts, Environment.enableFacetOptionCounts) *dynamic*: "how many results
 * would this option leave, given every filter already applied elsewhere" rather than a count over
 * every target instance regardless of what's already been selected. A facet's own constraint is
 * excluded so multi-selecting within the very same sh:in (an OR) doesn't shrink its own sibling
 * options' counts against each other - only *other* facets narrow a given facet's counts.
 *
 * Every other constraint kind (sh:in, sh:pattern, numeric ranges, sh:rootClass's class-hierarchy
 * sh:in, st:colorBucket) is answered by instancesConformingViaEngine's real shacl-engine validation
 * pass; st:withinArea is answered separately by matchingInstancesWithinArea, for the
 * Comunica-correctness reason explained on that function. Both are async - unlike the JS predicate
 * this replaced, there is real query-engine work to await here now, not just an in-memory walk.
 *
 * Returns `instances` unchanged (no filtering, not even an empty result) when there are no other
 * active constraints to check - the common case before the user has touched more than one facet.
 */
export async function instancesMatchingOtherConstraints(
  filterShape: FilterShape,
  dataGraph: RdfStore,
  instances: Quad_Subject[],
  excludePath: string | undefined,
): Promise<Quad_Subject[]> {
  const { store, rootNode } = filterShape;
  const otherConstraintNodes = store
    .getQuads(rootNode, sh("property"))
    .map((quad) => quad.object as Quad_Subject)
    .filter((node) => {
      if (excludePath === undefined) return true;
      const path = parsePropertyPath(node, store);
      return path === null || toSparql(path) !== excludePath;
    });

  if (otherConstraintNodes.length === 0) return instances;

  const withinAreaNodes = otherConstraintNodes.filter(
    (node) => store.getQuads(node, st("withinArea")).length > 0,
  );
  const engineNodes = otherConstraintNodes.filter((node) => !withinAreaNodes.includes(node));

  let matching = await instancesConformingViaEngine(store, dataGraph, engineNodes, instances);
  for (const node of withinAreaNodes) {
    const area = store.getQuads(node, st("withinArea"))[0]?.object;
    const path = parsePropertyPath(node, store);
    if (!area || !path) continue;
    matching = await matchingInstancesWithinArea(path, area, dataGraph, matching);
  }
  return matching;
}

// Deletes every triple reachable from `node` through blank-node objects - the constraint node's own
// path/value structure (e.g. a compound sh:path or an sh:in rdf:List) is private to it, nothing
// else in filterShape.store ever points into it, so this fully cleans it up rather than leaving
// unreachable blank-node triples behind in what modes/facet/index.tsx eventually submits.
function deleteBlankNodeClosure(store: RdfStore, node: Term): void {
  if (node.termType !== "BlankNode") return;
  for (const quad of store.getQuads(node)) {
    store.removeQuad(quad);
    deleteBlankNodeClosure(store, quad.object);
  }
}
