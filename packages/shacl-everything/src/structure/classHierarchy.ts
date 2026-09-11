import type { NamedNode } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdfs } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { valueNodeLabel } from "@/resolution/label.ts";
import type { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { BCP47 } from "@/types/BCP47.ts";

export type ClassNode = {
  term: NamedNode;
  label: string;
  children: ClassNode[];
};

/**
 * Walks rdfs:subClassOf downward from `root`, the same relation keepMostSpecificClasses in
 * PropertyUIElement.ts reads upward - both look for it on shapesGraph, since that's where this
 * codebase's fixtures declare ontology structure (rdfs:subClassOf, rdfs:label) alongside shapes.
 * Each class is itself a candidate/selected value of the property this hierarchy is being built
 * for, so its label is a value node label (8.2.3) - checked in dataGraph before shapesGraph, same
 * order. `seen` guards against a cyclical subClassOf graph, which would otherwise recurse forever.
 *
 * Shared by shui:SubClassEditor and st:SubClassFacet - both pick a class from the same
 * `sh:rootClass` taxonomy, just render/write it differently (a single/multi-value combobox vs a
 * facet's sh:in constraint).
 */
export function buildClassHierarchy(
  shape: PropertyUIElement,
  root: NamedNode,
  seen: Set<string>,
  languages: BCP47[],
): ClassNode {
  seen.add(root.value);
  const children = shape.shapesGraph
    .getQuads(null, rdfs("subClassOf"), root)
    .map((quad) => quad.subject as NamedNode)
    .filter((child) => !seen.has(child.value))
    .map((child) => buildClassHierarchy(shape, child, seen, languages));

  return {
    term: root,
    label: valueNodeLabel({ term: root, propertyShape: shape, languages }).value,
    children,
  };
}

/**
 * Keeps a node whose own label matches `query` together with its whole subtree (so a category hit
 * still shows what's under it), or - failing that - keeps it anyway if some descendant matches, but
 * trimmed down to only the matching branches. A non-matching node kept this way renders no row of
 * its own (see ClassHierarchyTree's `matches` check) - it's only a structural carrier so its
 * matching descendants stay reachable in the tree, rather than the whole branch being pruned away.
 */
export function filterClassTree(node: ClassNode, query: string): ClassNode | undefined {
  if (node.label.toLowerCase().includes(query)) return node;

  const filteredChildren = node.children
    .map((child) => filterClassTree(child, query))
    .filter((child): child is ClassNode => child !== undefined);

  return filteredChildren.length > 0 ? { ...node, children: filteredChildren } : undefined;
}

/**
 * Rolls st:SubClassFacet's own exact-match counts (Environment.enableFacetOptionCounts's
 * aggregateFacetValueCounts - "how many instances have this exact class as their value") up
 * through the rdfs:subClassOf tree, so a class's displayed count includes everything filed under
 * it too: ex:Electronics's count becomes its own direct matches plus ex:Computers's (and so on,
 * recursively), the same way picking a broad category in a real taxonomy facet implies everything
 * more specific under it. Without this, a non-leaf node would show "(0)" whenever nothing is
 * tagged with that exact class directly - which reads as "nothing here" rather than what it
 * actually means, "nothing filed at this exact level, only in the levels below".
 */
export function rollUpClassCounts(
  tree: ClassNode,
  exactCounts: Map<string, number>,
): Map<string, number> {
  const rolledUp = new Map<string, number>();

  const visit = (node: ClassNode): number => {
    const total = node.children.reduce(
      (sum, child) => sum + visit(child),
      exactCounts.get(termKey(node.term)) ?? 0,
    );
    rolledUp.set(termKey(node.term), total);
    return total;
  };

  visit(tree);
  return rolledUp;
}

/**
 * `root`'s own value plus every class transitively subordinate to it via rdfs:subClassOf on
 * `shapesGraph` - the same membership buildClassHierarchy's tree walk implies, without building a
 * full labeled ClassNode tree just to answer "is this value root or one of its descendants".
 * Used by filterShape.ts to make a class-taxonomy facet's sh:in constraint match not just the
 * exact class picked but anything filed under it too (e.g. picking ex:Electronics also matches a
 * value of ex:Computers, a subclass) - the filtering-side counterpart to rollUpClassCounts's
 * already-hierarchy-aware *display* counts above.
 */
export function collectClassAndSubClasses(
  shapesGraph: RdfStore,
  root: NamedNode,
  seen: Set<string> = new Set(),
): Set<string> {
  if (seen.has(root.value)) return seen;
  seen.add(root.value);
  for (const quad of shapesGraph.getQuads(null, rdfs("subClassOf"), root)) {
    collectClassAndSubClasses(shapesGraph, quad.subject as NamedNode, seen);
  }
  return seen;
}

/**
 * Pre-order list of the rows actually rendered as a selectable option - the order they appear in
 * the DOM top to bottom, used as a caller's roving keyboard-nav index. While searching, a node
 * whose own label doesn't match `query` renders no row of its own (see ClassHierarchyTree), so it's
 * excluded here too; its children are still walked, since one of them may match on its own even
 * though this ancestor didn't.
 */
export function flattenVisibleClassNodes(node: ClassNode, query: string): ClassNode[] {
  const matches = !query || node.label.toLowerCase().includes(query);
  const childItems = node.children.flatMap((child) => flattenVisibleClassNodes(child, query));
  return matches ? [node, ...childItems] : childItems;
}
