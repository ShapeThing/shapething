import type { NamedNode, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { sparqlFilterForBucket, type ColorBucket } from "@/helpers/colorBuckets.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { queryPrefixes, rdf, sh, st, xsd } from "@/helpers/namespaces.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
import { escapeSparqlLiteral } from "@/helpers/sparqlLiteral.ts";
import { collectClassAndSubClasses } from "@/structure/classHierarchy.ts";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
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
 *
 * Every facet constraint means "at least one value on this path matches", never SHACL's own
 * "every value matches (and zero values trivially conform)". So each sh:property carries its
 * value-level constraints (VALUE_LEVEL_PREDICATES: sh:in, sh:pattern/sh:flags, the four range
 * bounds) inside `sh:qualifiedValueShape [ ... ] ; sh:qualifiedMinCount 1` rather than directly - a
 * plain SHACL validator run against this shape then filters exactly the way the facets themselves
 * do (see facets/compileFilter.ts). Facet widgets never see that nesting: they read and write the
 * plain predicate through getConstraint/setConstraint, and readFilterConstraint/setFilterConstraint
 * resolve where it physically lives. The bespoke st:withinArea/st:colorBucket/st:classIn values sit
 * directly on the sh:property node, each alongside an equivalent sh:sparql SPARQLConstraint so an
 * external SHACL-SPARQL engine can enforce them without knowing ShapeThing's vocabulary.
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
  store.addQuad(factory.quad(rootNode, sh("property"), propertyNode));
  return propertyNode;
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

// Value-level constraints: a facet means them as "at least one value matches", so they live inside
// the sh:property node's sh:qualifiedValueShape (with sh:qualifiedMinCount 1), never directly on it
// - see FilterShape's doc comment.
const VALUE_LEVEL_PREDICATES = [
  sh("in"),
  sh("pattern"),
  sh("flags"),
  sh("minInclusive"),
  sh("maxInclusive"),
  sh("minExclusive"),
  sh("maxExclusive"),
];

function isValueLevel(predicate: NamedNode): boolean {
  return VALUE_LEVEL_PREDICATES.some((candidate) => candidate.equals(predicate));
}

function qualifiedValueShapeOf(store: RdfStore, constraintNode: Term): Quad_Subject | undefined {
  return store.getQuads(constraintNode as Quad_Subject, sh("qualifiedValueShape"))[0]?.object as
    | Quad_Subject
    | undefined;
}

/**
 * The current value(s) of `predicate` on `constraintNode`, wherever the output contract stores it
 * (see FilterShape) - an sh:in list or other RDF list is expanded to its members, an explicit empty
 * list (rdf:nil) to `[]`. The read-side counterpart of setFilterConstraint, and what a facet
 * widget's getConstraint resolves through.
 */
export function readFilterConstraint(
  filterShape: FilterShape,
  constraintNode: Quad_Subject,
  predicate: NamedNode,
): Term[] {
  const { store } = filterShape;
  const subject = isValueLevel(predicate)
    ? qualifiedValueShapeOf(store, constraintNode)
    : constraintNode;
  if (!subject) return [];
  return store
    .getQuads(subject, predicate)
    .flatMap((quad) => expandListOrTerm(quad.object, store));
}

/** Whether `predicate` is set on `constraintNode` at all - true even for an explicit empty list. */
export function hasFilterConstraint(
  filterShape: FilterShape,
  constraintNode: Quad_Subject,
  predicate: NamedNode,
): boolean {
  const { store } = filterShape;
  const subject = isValueLevel(predicate)
    ? qualifiedValueShapeOf(store, constraintNode)
    : constraintNode;
  return subject !== undefined && store.getQuads(subject, predicate).length > 0;
}

/** Every sh:property constraint node currently on `filterShape`. */
export function filterConstraintNodes(filterShape: FilterShape): Quad_Subject[] {
  return filterShape.store
    .getQuads(filterShape.rootNode, sh("property"))
    .map((quad) => quad.object as Quad_Subject);
}

/**
 * Replaces (or, when `value` is `undefined` or `[]`, removes) `constraintNode`'s current value(s)
 * for `predicate` - the write side a facet widget calls through FacetWidgetProps.setConstraint.
 * `value` as an array always writes a SHACL/RDF list (e.g. sh:in - even a single-member list stays
 * a list); a single Term always writes a plain triple (e.g. sh:minInclusive/sh:pattern). A
 * value-level predicate (VALUE_LEVEL_PREDICATES) is written into the node's sh:qualifiedValueShape,
 * which is created on the first such write and removed again once it's empty.
 *
 * `existingHead` - the old value, whatever it was - is always run through rebuildRdfList, even
 * when the new value isn't an array (or is undefined/`[]`): rebuildRdfList's own delete-then-build
 * pass is what actually removes a list's rdf:first/rdf:rest cells, not the plain removeQuad loop
 * (which only ever drops the subject -> predicate -> listHead link itself) - a harmless no-op
 * whenever `existingHead` was never a list head to begin with.
 *
 * A brand-new qualified value shape gets its content written *before* it's linked to
 * `constraintNode`, for the same reason setFilterConstraintsForProperty links a brand-new
 * sh:property node last: a reactive reader must never observe a linked-but-still-empty node.
 *
 * Once the write is done, if `constraintNode` no longer carries any constraint (only its own
 * sh:path is left - e.g. the last checkbox in a category facet was just unchecked), the whole
 * sh:property entry is pruned back out, so a facet with no value given never leaves a vacuous
 * sh:property/sh:path entry behind in what modes/facet/index.tsx submits.
 *
 * `shapesGraph`, when given, is only consulted for an st:classIn write (see
 * syncClassInSparqlConstraint) - callers with no class-taxonomy facet in play can omit it.
 */
export function setFilterConstraint(
  filterShape: FilterShape,
  constraintNode: Quad_Subject,
  predicate: NamedNode,
  value: Term | Term[] | undefined,
  shapesGraph?: RdfStore,
): void {
  const { store, rootNode } = filterShape;
  const valueLevel = isValueLevel(predicate);
  const existingQualified = valueLevel ? qualifiedValueShapeOf(store, constraintNode) : undefined;
  const subject = valueLevel ? (existingQualified ?? factory.blankNode()) : constraintNode;

  const existingQuads = store.getQuads(subject, predicate);
  const existingHead = existingQuads[0]?.object;
  for (const quad of existingQuads) store.removeQuad(quad);

  const listHead = rebuildRdfList(
    existingHead ?? rdf("nil"),
    Array.isArray(value) ? value : [],
    store,
  );
  if (Array.isArray(value)) {
    if (value.length > 0) {
      store.addQuad(factory.quad(subject, predicate, listHead as Quad_Object));
    }
  } else if (value !== undefined) {
    store.addQuad(factory.quad(subject, predicate, value as Quad_Object));
  }

  if (valueLevel) syncQualifiedValueShape(store, constraintNode, subject, !existingQualified);
  if (predicate.equals(st("withinArea"))) {
    syncWithinAreaSparqlConstraint(store, constraintNode, Array.isArray(value) ? undefined : value);
  }
  if (predicate.equals(st("colorBucket"))) {
    syncColorBucketSparqlConstraint(store, constraintNode, Array.isArray(value) ? undefined : value);
  }
  if (predicate.equals(st("classIn")) && shapesGraph) {
    syncClassInSparqlConstraint(store, constraintNode, shapesGraph);
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

// Links a freshly written qualified value shape into `constraintNode` (with its
// sh:qualifiedMinCount 1), or unlinks and removes an existing one that the write just emptied.
function syncQualifiedValueShape(
  store: RdfStore,
  constraintNode: Quad_Subject,
  qualified: Quad_Subject,
  isNew: boolean,
): void {
  const isEmpty = store.getQuads(qualified).length === 0;
  if (isNew) {
    if (isEmpty) return;
    store.addQuad(
      factory.quad(constraintNode, sh("qualifiedMinCount"), factory.literal("1", xsd("integer"))),
    );
    store.addQuad(factory.quad(constraintNode, sh("qualifiedValueShape"), qualified));
    return;
  }
  if (!isEmpty) return;
  for (const quad of store.getQuads(constraintNode, sh("qualifiedValueShape"))) store.removeQuad(quad);
  for (const quad of store.getQuads(constraintNode, sh("qualifiedMinCount"))) store.removeQuad(quad);
}

/**
 * Keeps constraintNode's own sh:sparql [ a sh:SPARQLConstraint ; sh:select "..." ] entry in sync
 * with its st:withinArea value (see setFilterConstraint above) - a real, standards-conformant SHACL
 * "SPARQL-based Constraint" (SHACL Core §3.5), built from the geof:sfWithin GeoSPARQL extension
 * function (see helpers/geosparqlFunctions.ts, registered on the Comunica engine in
 * helpers/queryEngine.ts), so an external SHACL-SPARQL-aware consumer of the shape this
 * renderer submits (e.g. shape-t-query, or any conformant SPARQL-based-constraints engine) can
 * enforce the exact same spatial rule without ever knowing ShapeThing's own st:withinArea
 * vocabulary. st:withinArea itself is left untouched by this function - it stays the plain value
 * MapFacet reads back and facets/compileFilter.ts compiles from.
 *
 * Always regenerates from scratch (delete-then-rebuild, like rebuildRdfList) rather than trying to
 * patch the previous sh:select text in place - MapFacet re-calls this on every drawn-shape change,
 * so there's no meaningful "diff" to preserve, only a
 * current value to reflect.
 *
 * The generated query uses FILTER NOT EXISTS (the spec-correct, portable "for-all" shape - $this
 * violates unless *some* value satisfies geof:sfWithin) rather than a MINUS-based rewrite - this
 * exact text is never run by this renderer's own matching (facets/compileFilter.ts compiles
 * st:withinArea into a positive-form join instead, for exactly the reason below), only kept here for
 * an external SHACL-SPARQL-aware consumer. Comunica
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
 * sitting right there as a literal. Like its st:withinArea sibling, this text is only kept for an
 * external consumer - facets/compileFilter.ts compiles st:colorBucket from the same
 * sparqlFilterForBucket into this renderer's own facet queries.
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
 * with its st:classIn value - SubClassFacet's class-taxonomy pick: each *chosen* class should also
 * match its own subclasses, not just an exact-term match (a category faceted as "Electronics" should
 * still count a product tagged "Computers"). The same "bespoke value plus a portable SPARQL
 * sibling" split st:withinArea/st:colorBucket use: st:classIn holds exactly what the user picked
 * (what the widget reads back), the sh:sparql holds the real constraint.
 *
 * The allowed-classes closure (collectClassAndSubClasses, over `shapesGraph`'s own rdfs:subClassOf
 * triples, one call per chosen value) is resolved once here, at write time, into a flat VALUES list
 * baked directly into the generated query text - the taxonomy typically lives in the shapes graph,
 * which an external consumer validating against the data graph alone wouldn't see.
 */
function syncClassInSparqlConstraint(
  store: RdfStore,
  constraintNode: Quad_Subject,
  shapesGraph: RdfStore,
): void {
  const existingSparqlQuad = store.getQuads(constraintNode, sh("sparql"))[0];
  if (existingSparqlQuad) {
    store.removeQuad(existingSparqlQuad);
    deleteBlankNodeClosure(store, existingSparqlQuad.object);
  }

  const classInQuad = store.getQuads(constraintNode, st("classIn"))[0];
  const path = parsePropertyPath(constraintNode, store);
  if (!classInQuad || !path) return;

  const allowedClasses = classClosure(expandListOrTerm(classInQuad.object, store), shapesGraph);
  if (allowedClasses.length === 0) return;

  const valuesList = allowedClasses.map((iri) => `<${iri}>`).join(" ");
  const sparqlNode = factory.blankNode();
  store.addQuad(factory.quad(sparqlNode, rdf("type"), sh("SPARQLConstraint")));
  store.addQuad(
    factory.quad(
      sparqlNode,
      sh("select"),
      factory.literal(
        `${queryPrefixes}\nselect $this where { filter not exists { $this ${toSparql(path)} ?classInValue . values ?classInValue { ${valuesList} } } }`,
      ),
    ),
  );
  store.addQuad(factory.quad(constraintNode, sh("sparql"), sparqlNode as Quad_Object));
}

/** Every one of `classes` plus all their rdfs:subClassOf descendants in `shapesGraph`, as IRIs. */
export function classClosure(classes: Term[], shapesGraph: RdfStore): string[] {
  const allowed = new Set<string>();
  for (const term of classes) {
    if (term.termType !== "NamedNode") continue;
    for (const iri of collectClassAndSubClasses(shapesGraph, term)) allowed.add(iri);
  }
  return [...allowed];
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
