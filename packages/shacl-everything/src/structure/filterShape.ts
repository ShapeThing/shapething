import type { NamedNode, Quad_Object, Quad_Subject, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { rebuildRdfList } from "@/helpers/rdfList.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
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
 * Finds (or auto-vivifies) the sh:property blank node on `filterShape` that holds constraints for
 * `property`'s own path - the write-side counterpart to structure/facetValues.ts's
 * aggregateFacetValues. The first call for a given path deep-copies the source property shape's
 * own sh:path structure (via writePropertyPath, so a compound path like sh:alternativePath carries
 * over faithfully) and attaches the new node to the root via sh:property; a later call for the
 * same path (compared canonically, same as propertiesForShape's own co-path grouping) returns the
 * same node rather than creating a duplicate sh:property entry.
 */
export function getFilterConstraintNode(
  filterShape: FilterShape,
  property: PropertyUIElement,
): Quad_Subject {
  const { store, rootNode } = filterShape;
  const sourcePropertyShape = property.propertyShapes[0];
  const path = parsePropertyPath(sourcePropertyShape, property.shapesGraph);
  const sparqlPath = pathSparqlFor(property);

  const existing = store
    .getQuads(rootNode, sh("property"))
    .map((quad) => quad.object as Quad_Subject)
    .find((propertyNode) => {
      if (sparqlPath === undefined) return false;
      const existingPath = parsePropertyPath(propertyNode, store);
      return existingPath !== null && toSparql(existingPath) === sparqlPath;
    });
  if (existing) return existing;

  const propertyNode = factory.blankNode();
  store.addQuad(factory.quad(rootNode, sh("property"), propertyNode));
  if (path) {
    store.addQuad(
      factory.quad(propertyNode, sh("path"), writePropertyPath(path, store) as Quad_Object),
    );
  }
  return propertyNode;
}

/**
 * Replaces (or, when `value` is `undefined`, removes) `constraintNode`'s current value(s) for
 * `predicate` - the write side a facet widget calls through FacetWidgetProps.setConstraint.
 * `value` as an array always writes a SHACL/RDF list (e.g. sh:in - even a single-member list stays
 * a list); a single Term always writes a plain triple (e.g. sh:minInclusive/sh:pattern).
 */
export function setFilterConstraint(
  filterShape: FilterShape,
  constraintNode: Quad_Subject,
  predicate: NamedNode,
  value: Term | Term[] | undefined,
): void {
  const { store } = filterShape;
  const existingQuads = store.getQuads(constraintNode, predicate);
  const existingHead = existingQuads[0]?.object;

  for (const quad of existingQuads) store.removeQuad(quad);
  if (value === undefined) return;

  if (Array.isArray(value)) {
    if (value.length === 0) return;
    const listHead = rebuildRdfList(existingHead ?? rdf("nil"), value, store);
    store.addQuad(factory.quad(constraintNode, predicate, listHead as Quad_Object));
    return;
  }

  store.addQuad(factory.quad(constraintNode, predicate, value as Quad_Object));
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
