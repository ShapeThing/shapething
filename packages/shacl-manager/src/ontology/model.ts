import type { NamedNode, Term } from "@rdfjs/types";
import type { TypedQuery } from "@shapething/typed-sparql";
import type classesQuery from "./classes.rq";
import type propertiesQuery from "./properties.rq";

type ClassRow = typeof classesQuery extends TypedQuery<infer T> ? T : never;
type PropertyRow = typeof propertiesQuery extends TypedQuery<infer T> ? T : never;

export type OwlClass = {
  iri: string;
  term: NamedNode;
  parents: Set<string>;
  children: Set<string>;
};

export type ClassIndex = Map<string, OwlClass>;

export type ClassTreeNode = {
  owlClass: OwlClass;
  children: ClassTreeNode[];
};

export type OwlProperty = {
  iri: string;
  term: NamedNode;
  types: Set<string>;
  domains: Set<string>;
  ranges: Set<string>;
};

export type PropertyIndex = Map<string, OwlProperty>;

export function buildClassIndex(rows: ClassRow[]): ClassIndex {
  const index: ClassIndex = new Map();
  const get = (term: NamedNode) => {
    let owlClass = index.get(term.value);
    if (!owlClass) {
      owlClass = { iri: term.value, term, parents: new Set(), children: new Set() };
      index.set(term.value, owlClass);
    }
    return owlClass;
  };

  for (const row of rows) {
    const owlClass = get(row.class);
    if (row.superClass?.termType !== "NamedNode") continue;
    // `C rdfs:subClassOf C` is legal and common in inferred data, but is no edge in a tree.
    if (row.superClass.value === row.class.value) continue;
    const parent = get(row.superClass);
    owlClass.parents.add(parent.iri);
    parent.children.add(owlClass.iri);
  }

  return index;
}

/** All (transitive) superclasses of `iri`, nearest first. Cycle safe. */
export function ancestorsOf(index: ClassIndex, iri: string): string[] {
  const result: string[] = [];
  const seen = new Set([iri]);
  let frontier = [iri];
  while (frontier.length) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const parent of index.get(current)?.parents ?? []) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        result.push(parent);
        next.push(parent);
      }
    }
    frontier = next;
  }
  return result;
}

/**
 * Turns the class index into a forest. A class with several superclasses appears under each of
 * them. `include`, when given, restricts the forest to those classes (a class whose parents are all
 * excluded becomes a root), which is how the focus view shows just a class and its ancestors.
 */
export function buildClassForest(
  index: ClassIndex,
  sortKey: (owlClass: OwlClass) => string,
  include?: ReadonlySet<string>,
): ClassTreeNode[] {
  const included = (iri: string) => index.has(iri) && (!include || include.has(iri));
  const compare = (a: ClassTreeNode, b: ClassTreeNode) =>
    sortKey(a.owlClass).localeCompare(sortKey(b.owlClass));
  const visited = new Set<string>();

  const build = (iri: string, ancestors: ReadonlySet<string>): ClassTreeNode => {
    visited.add(iri);
    const owlClass = index.get(iri)!;
    const nextAncestors = new Set(ancestors).add(iri);
    return {
      owlClass,
      // A subClassOf cycle must not recurse forever: a child that is already an ancestor is cut.
      children: [...owlClass.children]
        .filter((child) => included(child) && !nextAncestors.has(child))
        .map((child) => build(child, nextAncestors))
        .sort(compare),
    };
  };

  const roots = [...index.keys()].filter(
    (iri) => included(iri) && ![...index.get(iri)!.parents].some(included),
  );
  const forest = roots.map((iri) => build(iri, new Set()));

  // Every member of a pure cycle has a parent, so none of them is a root. Surface what the walk
  // above never reached instead of silently dropping it.
  for (const iri of index.keys()) {
    if (included(iri) && !visited.has(iri)) forest.push(build(iri, new Set()));
  }

  return forest.sort(compare);
}

/** Keeps only nodes for which `keep` holds, lifting kept descendants of dropped nodes up. */
export function pruneForest(
  forest: ClassTreeNode[],
  keep: (owlClass: OwlClass) => boolean,
): ClassTreeNode[] {
  return forest.flatMap((node) => {
    const children = pruneForest(node.children, keep);
    return keep(node.owlClass) ? [{ ...node, children }] : children;
  });
}

export function buildPropertyIndex(rows: PropertyRow[]): PropertyIndex {
  const index: PropertyIndex = new Map();
  for (const row of rows) {
    if (row.property.termType !== "NamedNode") continue;
    let property = index.get(row.property.value);
    if (!property) {
      property = {
        iri: row.property.value,
        term: row.property,
        types: new Set(),
        domains: new Set(),
        ranges: new Set(),
      };
      index.set(property.iri, property);
    }
    property.types.add(row.type.value);
    if (row.domain?.termType === "NamedNode") property.domains.add(row.domain.value);
    if (row.range?.termType === "NamedNode") property.ranges.add(row.range.value);
  }
  return index;
}

export function isOwlProperty(index: PropertyIndex, term: Term | undefined): term is NamedNode {
  return term?.termType === "NamedNode" && index.has(term.value);
}
