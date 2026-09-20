import type { TypedQuery } from "@shapething/typed-sparql";
import { localName } from "@shapething/shacl-everything";
import { factory } from "@/helpers/factory.ts";
import type fetchClassHierarchy from "./fetchClassHierarchy.rq";

type Row = typeof fetchClassHierarchy extends TypedQuery<infer T> ? T : never;

export type ClassHierarchyNode = {
  iri: string;
  label: string;
  hasShape: boolean;
  shapeIri: string | undefined;
  children: ClassHierarchyNode[];
};

// Turns the flat class/superClass rows into a forest. A class can have more than one
// rdfs:subClassOf parent (multiple inheritance), so it's duplicated under each parent rather than
// picking just one. A class that's only ever seen as someone else's superClass - never itself
// bound to ?class, e.g. an ancestor with no shape/instance data of its own - still gets a node so
// the chain isn't cut short.
export function buildClassHierarchy(rows: Row[]): ClassHierarchyNode[] {
  const childrenByParent = new Map<string, Set<string>>();
  const allIris = new Set<string>();
  const hasParent = new Set<string>();
  const shapedIris = new Set<string>();
  const shapeIriByIri = new Map<string, string>();
  const labelByIri = new Map<string, string>();

  for (const row of rows) {
    allIris.add(row.class.value);
    // Only branches 1/2 of fetchClassHierarchy.rq bind ?shape - a class that only qualifies via
    // instance data (branch 3) leaves it unbound, so this can be undefined at runtime despite the
    // query's declared (non-optional) result type.
    if (row.shape !== undefined) {
      shapedIris.add(row.class.value);
      if (row.shape.termType === "NamedNode" && !shapeIriByIri.has(row.class.value)) {
        shapeIriByIri.set(row.class.value, row.shape.value);
      }
    }

    if (row.label !== undefined && !labelByIri.has(row.class.value)) {
      labelByIri.set(row.class.value, row.label.value);
    }

    if (row.superClass?.termType !== "NamedNode") continue;

    const parentIri = row.superClass.value;
    allIris.add(parentIri);
    hasParent.add(row.class.value);

    let children = childrenByParent.get(parentIri);
    if (!children) {
      children = new Set();
      childrenByParent.set(parentIri, children);
    }
    children.add(row.class.value);
  }

  const visited = new Set<string>();

  function buildNode(iri: string, ancestors: ReadonlySet<string>): ClassHierarchyNode {
    visited.add(iri);
    const nextAncestors = new Set(ancestors).add(iri);
    const childIris = childrenByParent.get(iri) ?? new Set<string>();

    return {
      iri,
      label: labelByIri.get(iri) ?? localName(factory.namedNode(iri)) ?? iri,
      hasShape: shapedIris.has(iri),
      shapeIri: shapeIriByIri.get(iri),
      // A cycle in the data (shouldn't happen for well-formed rdfs:subClassOf, but this is
      // user-supplied RDF, and mixing multiple imported ontologies makes it easy to end up with
      // one by accident) must not recurse forever, so a child that's already its own ancestor is
      // dropped instead of walked into again.
      children: [...childIris]
        .filter((childIri) => !nextAncestors.has(childIri))
        .map((childIri) => buildNode(childIri, nextAncestors))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  }

  const trueRoots = [...allIris].filter((iri) => !hasParent.has(iri));
  const nodes = trueRoots.map((iri) => buildNode(iri, new Set()));

  // A subClassOf cycle leaves every class in it with a recorded parent, so none of them is a
  // "true" root and the cycle is never reached by the walk above - which would otherwise make the
  // whole cycle silently disappear from the list instead of just being mis-nested. Anything still
  // unvisited after the real roots are walked gets surfaced as its own top-level entry instead.
  for (const iri of allIris) {
    if (!visited.has(iri)) nodes.push(buildNode(iri, new Set()));
  }

  return nodes.sort((a, b) => a.label.localeCompare(b.label));
}

// Keeps only classes that have their own shape, re-parenting a kept class under its nearest
// shaped ancestor (or promoting it to the top level) instead of leaving gaps where an unshaped
// ancestor used to sit - so toggling the filter narrows the list without breaking the hierarchy
// apart.
export function filterToShapedClasses(nodes: ClassHierarchyNode[]): ClassHierarchyNode[] {
  const result = nodes.flatMap((node) => {
    const children = filterToShapedClasses(node.children);
    if (node.hasShape) return [{ ...node, children }];
    return children;
  });
  return result.sort((a, b) => a.label.localeCompare(b.label));
}

// Every shapeIri that has its own entry (and so its own Link) somewhere in the tree - a property
// shape can be reached through several rootShape candidates (e.g. both the shape that declares it
// and one that reuses it via sh:node, see fetchPropertyShapes.rq), and only one of those
// candidates is ever an actual node here.
export function collectShapeIris(nodes: ClassHierarchyNode[]): Set<string> {
  const shapeIris = new Set<string>();
  const visit = (list: ClassHierarchyNode[]) => {
    for (const node of list) {
      if (node.shapeIri) shapeIris.add(node.shapeIri);
      visit(node.children);
    }
  };
  visit(nodes);
  return shapeIris;
}
