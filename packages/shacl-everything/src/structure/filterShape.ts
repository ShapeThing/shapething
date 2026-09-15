import type { NamedNode, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { bucketForHsl, sparqlFilterForBucket, type ColorBucket } from "@/helpers/colorBuckets.ts";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { geometryIntersectsArea, literalToGeometry } from "@/helpers/geometryLiteral.ts";
import { queryPrefixes, rdf, sh, st } from "@/helpers/namespaces.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
import { collectClassAndSubClasses } from "@/structure/classHierarchy.ts";
import { literalOrder } from "@/structure/constraintResolutions.ts";
import { parsePropertyPath } from "@/structure/paths/parsePropertyPath.ts";
import { toSparql } from "@/structure/paths/toSparql.ts";
import { walkPropertyPath } from "@/structure/paths/walkPropertyPath.ts";
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
 * generated filter constraint node, the same way the path itself is copied - so
 * instanceSatisfiesConstraintNode below can tell, from the constraint node alone, that this
 * property's sh:in is a class-taxonomy pick (rollUpClassCounts's own hierarchy - Electronics
 * should also match Computers, a subclass) rather than an ordinary exact-match option list
 * (CategoryFacet), and so the shape modes/facet/index.tsx eventually submits stays self-describing
 * enough for an external consumer to reproduce the same hierarchy-aware matching.
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
      setFilterConstraint(filterShape, existing, predicate, value);
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
    setFilterConstraint(filterShape, propertyNode, predicate, value);
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
 */
export function setFilterConstraint(
  filterShape: FilterShape,
  constraintNode: Quad_Subject,
  predicate: NamedNode,
  value: Term | Term[] | undefined,
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
 * this renderer's own synchronous facet-narrowing (instanceSatisfiesConstraintNode below,
 * facetValues.ts's countFacetInstancesWithinArea) reads directly, the same "real SHACL predicate
 * plus an auxiliary st: value for the app's own fast synchronous path" split copyRootClass already
 * uses for sh:in's class-taxonomy matching above - re-deriving the drawn area from generated SPARQL
 * text on every facet-count read would be needless, fragile work for a value already sitting right
 * there as a literal.
 *
 * Always regenerates from scratch (delete-then-rebuild, like rebuildRdfList) rather than trying to
 * patch the previous sh:select text in place - MapFacet re-calls this on every drawn-shape change
 * (and its own 400ms poll - see widget.tsx), so there's no meaningful "diff" to preserve, only a
 * current value to reflect.
 *
 * The generated query uses FILTER NOT EXISTS (the spec-correct, portable "for-all" shape - $this
 * violates unless *some* value satisfies geof:sfWithin) rather than a MINUS-based rewrite - this
 * renderer never runs the query itself (see above), but if it ever does, note that Comunica 4.5
 * does *not* correctly correlate $this into a FILTER NOT EXISTS pattern when a custom extension
 * function (like geof:sfWithin) sits inside it: the nested pattern resolves against the wrong outer
 * binding regardless of which $this is active (verified against a minimal repro outside this
 * codebase). A MINUS-based rewrite correlates correctly under Comunica, but silently drops the
 * "zero values for the path is also a violation" case (MINUS needs $this to already join through
 * at least one value to appear as a row at all) - not a safe substitute, just a different bug.
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
 * with its st:colorBucket value (see setFilterConstraint above) - the same "bespoke value for this
 * renderer's own fast synchronous path, standards-form SPARQL text for an external consumer" split
 * syncWithinAreaSparqlConstraint above uses for MapFacet's st:withinArea. st:colorBucket itself is
 * left untouched by this function - it stays the plain bucket-name literal
 * instanceSatisfiesConstraintNode below reads directly (via helpers/colorBuckets.ts's bucketForHsl,
 * applied to each value's own st:hue/st:saturation/st:lightness triples) - re-deriving the bucket
 * from generated SPARQL text on every facet-count read would be needless, fragile work for a value
 * already sitting right there as a literal.
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

// Whether `instance`'s own values for `constraintNode`'s path satisfy every constraint predicate
// currently written on it (sh:in, sh:pattern+sh:flags, sh:minInclusive/sh:maxInclusive/
// sh:minExclusive/sh:maxExclusive, st:withinArea, st:colorBucket - the only predicates any facet
// widget ever writes via setConstraint) - true if the node declares none of them (a bare
// sh:property/sh:path skeleton, which auto-vivify never actually leaves lying around, but this
// stays permissive rather than assuming). A predicate this doesn't recognize is silently ignored
// rather than excluding every instance - only facet-writable predicates are meaningful here.
function instanceSatisfiesConstraintNode(
  constraintNode: Quad_Subject,
  instance: Quad_Subject,
  store: RdfStore,
  dataGraph: RdfStore,
  shapesGraph: RdfStore,
): boolean {
  const path = parsePropertyPath(constraintNode, store);
  if (!path) return true;
  const values = walkPropertyPath(path, instance, dataGraph);

  const inQuad = store.getQuads(constraintNode, sh("in"))[0];
  if (inQuad) {
    const allowed = expandListOrTerm(inQuad.object, store);
    // A class-taxonomy pick (see copyRootClass above) matches not just the exact class chosen but
    // anything filed under it too - ex:Electronics also matches a value of ex:Computers, one of
    // its subclasses - rather than plain sh:in's ordinary exact-term-equality membership test.
    const isClassHierarchy = store.getQuads(constraintNode, sh("rootClass")).length > 0;
    const satisfiesIn = (value: Term): boolean =>
      allowed.some((term) => term.equals(value)) ||
      (isClassHierarchy &&
        value.termType === "NamedNode" &&
        allowed.some(
          (term) =>
            term.termType === "NamedNode" &&
            collectClassAndSubClasses(shapesGraph, term).has(value.value),
        ));
    if (!values.some(satisfiesIn)) return false;
  }

  const patternQuad = store.getQuads(constraintNode, sh("pattern"))[0];
  if (patternQuad) {
    const flags = store.getQuads(constraintNode, sh("flags"))[0]?.object.value ?? "";
    const regex = new RegExp(patternQuad.object.value, flags);
    if (!values.some((value) => regex.test(value.value))) return false;
  }

  const minInclusiveQuad = store.getQuads(constraintNode, sh("minInclusive"))[0];
  const maxInclusiveQuad = store.getQuads(constraintNode, sh("maxInclusive"))[0];
  const minExclusiveQuad = store.getQuads(constraintNode, sh("minExclusive"))[0];
  const maxExclusiveQuad = store.getQuads(constraintNode, sh("maxExclusive"))[0];
  if (minInclusiveQuad || maxInclusiveQuad || minExclusiveQuad || maxExclusiveQuad) {
    const minInclusiveOrder = minInclusiveQuad
      ? literalOrder(minInclusiveQuad.object as Term)
      : undefined;
    const maxInclusiveOrder = maxInclusiveQuad
      ? literalOrder(maxInclusiveQuad.object as Term)
      : undefined;
    const minExclusiveOrder = minExclusiveQuad
      ? literalOrder(minExclusiveQuad.object as Term)
      : undefined;
    const maxExclusiveOrder = maxExclusiveQuad
      ? literalOrder(maxExclusiveQuad.object as Term)
      : undefined;
    const inRange = values.some((value) => {
      const order = literalOrder(value);
      const aboveMin =
        (minInclusiveOrder === undefined || order >= minInclusiveOrder) &&
        (minExclusiveOrder === undefined || order > minExclusiveOrder);
      const belowMax =
        (maxInclusiveOrder === undefined || order <= maxInclusiveOrder) &&
        (maxExclusiveOrder === undefined || order < maxExclusiveOrder);
      return aboveMin && belowMax;
    });
    if (!inRange) return false;
  }

  // st:withinArea - MapFacet's own constraint predicate (see widgets/implementations/st/facets/
  // MapFacet), holding a GeoSPARQL WKT literal for the Polygon/MultiPolygon area the user drew on
  // the map - this renderer's own fast synchronous read of the same value a sibling sh:sparql
  // SPARQLConstraint entry (see setFilterConstraint/syncWithinAreaSparqlConstraint above) also
  // expresses in standard, portable SHACL-SPARQL form for an external consumer. An instance matches
  // if *any* of its own values for this path falls inside the drawn area - see
  // helpers/geometryLiteral.ts's geometryIntersectsArea for what "inside" means here.
  const withinAreaQuad = store.getQuads(constraintNode, st("withinArea"))[0];
  if (withinAreaQuad) {
    const area = literalToGeometry(withinAreaQuad.object as Term);
    if (area) {
      const withinArea = values.some((value) => {
        const geometry = literalToGeometry(value);
        return geometry !== undefined && geometryIntersectsArea(geometry, area);
      });
      if (!withinArea) return false;
    }
  }

  // st:colorBucket - ColorFacet's own constraint predicate (see widgets/implementations/st/facets/
  // ColorFacet), holding the name of the bucket picked (e.g. "blue") - the same fast synchronous
  // read/write split st:withinArea uses above: a sibling sh:sparql SPARQLConstraint entry (see
  // setFilterConstraint/syncColorBucketSparqlConstraint above) expresses the identical rule in
  // standard, portable SHACL-SPARQL form for an external consumer, reading straight off each
  // value's own st:hue/st:saturation/st:lightness triples - genuine CSS HSL notation, not a derived
  // property. An instance matches if *any* of its own values for this path (each an HSL-shaped
  // blank/named node) classifies into the chosen bucket - see helpers/colorBuckets.ts's
  // bucketForHsl for what "classifies into" means here.
  const colorBucketQuad = store.getQuads(constraintNode, st("colorBucket"))[0];
  if (colorBucketQuad) {
    const bucket = colorBucketQuad.object.value as ColorBucket;
    const matchesBucket = values.some((value) => {
      if (value.termType !== "BlankNode" && value.termType !== "NamedNode") return false;
      const hue = dataGraph.getQuads(value, st("hue"))[0]?.object.value;
      const saturation = dataGraph.getQuads(value, st("saturation"))[0]?.object.value;
      const lightness = dataGraph.getQuads(value, st("lightness"))[0]?.object.value;
      if (hue === undefined || saturation === undefined || lightness === undefined) return false;
      return (
        bucketForHsl({ h: parseFloat(hue), s: parseFloat(saturation), l: parseFloat(lightness) }) ===
        bucket
      );
    });
    if (!matchesBucket) return false;
  }

  return true;
}

/**
 * `instances` narrowed down to only the ones satisfying every *other* currently-active facet
 * constraint on `filterShape` - "other" meaning every sh:property entry except the one whose own
 * path equals `excludePath` (typically the facet asking the question, via pathSparqlFor - compare
 * `undefined` to exclude nothing). This is what makes a facet's own option/range counts (see
 * structure/facetValues.ts, Environment.enableFacetOptionCounts) *dynamic*: "how many results
 * would this option leave, given every filter already applied elsewhere" rather than a count over
 * every target instance regardless of what's already been selected. A facet's own constraint is
 * excluded so multi-selecting within the very same sh:in (an OR) doesn't shrink its own sibling
 * options' counts against each other - only *other* facets narrow a given facet's counts.
 *
 * Returns `instances` unchanged (no filtering, not even an empty result) when there are no other
 * active constraints to check - the common case before the user has touched more than one facet.
 */
export function instancesMatchingOtherConstraints(
  filterShape: FilterShape,
  dataGraph: RdfStore,
  shapesGraph: RdfStore,
  instances: Quad_Subject[],
  excludePath: string | undefined,
): Quad_Subject[] {
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
  return instances.filter((instance) =>
    otherConstraintNodes.every((node) =>
      instanceSatisfiesConstraintNode(node, instance, store, dataGraph, shapesGraph),
    ),
  );
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
