import type { NamedNode, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { expandListOrTerm } from "@/helpers/expandListOrTerm.ts";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
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
  store.addQuad(factory.quad(rootNode, sh("property"), propertyNode));
  return propertyNode;
}

/**
 * The combined find-or-create-and-write every facet widget's own setConstraint should call,
 * instead of calling getFilterConstraintNode then setFilterConstraint as two separate steps.
 *
 * The difference matters under React: filterShape.store is reactive (helpers/reactiveRdfStore.ts),
 * and a facet's own live read is a useSyncExternalStore subscription (useReactiveRead), which
 * forces an *immediate, synchronous* re-render the instant a write matches its tracked pattern -
 * before the calling code gets to run any further statements. Every sibling facet watches the same
 * wildcard rootNode/sh:property pattern (to notice a completely new constraint appearing anywhere),
 * so if getFilterConstraintNode's create branch linked a brand-new, still-empty node into rootNode
 * *before* setFilterConstraint got a chance to write its first real value, that forced re-render
 * would observe (and permanently cache, until the *next* matching write) a property with no value
 * yet - a checkbox that doesn't reflect its own click, a search box or price range that doesn't
 * pick up its own first keystroke, even though the value is written correctly moments later and the
 * generated shape modes/facet/index.tsx eventually submits ends up correct regardless (its own
 * subscription is an unconditional catch-all, unaffected by this ordering).
 *
 * This writes a brand-new node's own sh:path and its first value *before* linking it to rootNode,
 * so the one write any sibling's wildcard pattern can actually observe already describes a complete
 * constraint. An already-existing node (found via findFilterConstraintNode) has no such race - it's
 * already linked and already being watched via its own subject-wildcard pattern - so it's just
 * handed straight to setFilterConstraint.
 */
export function setFilterConstraintForProperty(
  filterShape: FilterShape,
  property: PropertyUIElement,
  predicate: NamedNode,
  value: Term | Term[] | undefined,
): void {
  const existing = findFilterConstraintNode(filterShape, property);
  if (existing) {
    setFilterConstraint(filterShape, existing, predicate, value);
    return;
  }

  const isEmpty = value === undefined || (Array.isArray(value) && value.length === 0);
  if (isEmpty) return;

  const { store, rootNode } = filterShape;
  const path = parsePropertyPath(property.propertyShapes[0], property.shapesGraph);

  const propertyNode = factory.blankNode();
  if (path) {
    store.addQuad(
      factory.quad(propertyNode, sh("path"), writePropertyPath(path, store) as Quad_Object),
    );
  }
  setFilterConstraint(filterShape, propertyNode, predicate, value);
  store.addQuad(factory.quad(rootNode, sh("property"), propertyNode));
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

  const stillHasConstraint = store
    .getQuads(constraintNode)
    .some((quad) => !quad.predicate.equals(sh("path")));
  if (stillHasConstraint) return;

  const propertyQuad = store.getQuads(rootNode, sh("property"), constraintNode)[0];
  if (!propertyQuad) return;
  store.removeQuad(propertyQuad);
  deleteBlankNodeClosure(store, constraintNode);
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
// currently written on it (sh:in, sh:pattern+sh:flags, sh:minInclusive/sh:maxInclusive - the only
// predicates any facet widget ever writes via setConstraint) - true if the node declares none of
// them (a bare sh:property/sh:path skeleton, which auto-vivify never actually leaves lying around,
// but this stays permissive rather than assuming). A predicate this doesn't recognize is silently
// ignored rather than excluding every instance - only facet-writable predicates are meaningful here.
function instanceSatisfiesConstraintNode(
  constraintNode: Quad_Subject,
  instance: Quad_Subject,
  store: RdfStore,
  dataGraph: RdfStore,
): boolean {
  const path = parsePropertyPath(constraintNode, store);
  if (!path) return true;
  const values = walkPropertyPath(path, instance, dataGraph);

  const inQuad = store.getQuads(constraintNode, sh("in"))[0];
  if (inQuad) {
    const allowed = expandListOrTerm(inQuad.object, store);
    if (!values.some((value) => allowed.some((term) => term.equals(value)))) return false;
  }

  const patternQuad = store.getQuads(constraintNode, sh("pattern"))[0];
  if (patternQuad) {
    const flags = store.getQuads(constraintNode, sh("flags"))[0]?.object.value ?? "";
    const regex = new RegExp(patternQuad.object.value, flags);
    if (!values.some((value) => regex.test(value.value))) return false;
  }

  const minQuad = store.getQuads(constraintNode, sh("minInclusive"))[0];
  const maxQuad = store.getQuads(constraintNode, sh("maxInclusive"))[0];
  if (minQuad || maxQuad) {
    const minOrder = minQuad ? literalOrder(minQuad.object as Term) : undefined;
    const maxOrder = maxQuad ? literalOrder(maxQuad.object as Term) : undefined;
    const inRange = values.some((value) => {
      const order = literalOrder(value);
      const aboveMin = minOrder === undefined || order >= minOrder;
      const belowMax = maxOrder === undefined || order <= maxOrder;
      return aboveMin && belowMax;
    });
    if (!inRange) return false;
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
      instanceSatisfiesConstraintNode(node, instance, store, dataGraph),
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
