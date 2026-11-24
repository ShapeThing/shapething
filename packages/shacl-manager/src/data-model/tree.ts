import type { NamedNode } from "@rdfjs/types";
import type { Resource } from "./rdf.ts";

// One (node, parent) edge of a hierarchy, parent unbound for a root.
export type TreeRow = {
  parent?: Resource;
  propertyCount?: { value: string };
  queryCount?: { value: string };
  ruleCount?: { value: string };
};

export type TreeNode = {
  term: Resource;
  // Its properties, queries and rules together, as far as the rows count them.
  count?: number;
  children: TreeNode[];
  // In the sidebar, which mixes them: what the node is, and where it is declared. A class that is
  // only referenced, such as a target class of a shape whose ontology isn't imported, has no origin.
  kind?: "class" | "shape" | "group";
  origin?: "managed" | "imported";
  // The imported graph that declares it.
  source?: NamedNode;
  // Shown only because something below it matches the sidebar's filter.
  context?: boolean;
};

// A sidebar's two sections: the nested hierarchy and everything outside it.
export type Sections = { hierarchy: TreeNode[]; other: TreeNode[] };

// Every level keeps row order. A node with several parents appears under each. A cycle is cut
// where it closes; nodes only reachable through a cycle become roots, so every node shows up.
export function buildTree<Row extends TreeRow>(
  rows: Row[],
  termOf: (row: Row) => Resource,
): TreeNode[] {
  const counts = new Map<string, number | undefined>();
  const terms = new Map<string, Resource>();
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const row of rows) {
    const term = termOf(row);
    const { parent } = row;
    const parts = [row.propertyCount, row.queryCount, row.ruleCount].filter((part) => part);
    terms.set(term.value, term);
    counts.set(
      term.value,
      parts.length ? parts.reduce((sum, part) => sum + Number(part!.value), 0) : undefined,
    );
    if (!parent) continue;
    hasParent.add(term.value);
    const siblings = children.get(parent.value) ?? [];
    if (!siblings.includes(term.value)) siblings.push(term.value);
    children.set(parent.value, siblings);
  }

  const reached = new Set<string>();
  const build = (id: string, ancestors: Set<string>): TreeNode => {
    reached.add(id);
    const path = new Set(ancestors).add(id);
    return {
      term: terms.get(id)!,
      count: counts.get(id),
      children: (children.get(id) ?? [])
        .filter((child) => !path.has(child))
        .map((child) => build(child, path)),
    };
  };

  const roots = [...terms.keys()]
    .filter((id) => !hasParent.has(id))
    .map((id) => build(id, new Set()));
  for (const id of terms.keys()) {
    if (!reached.has(id)) roots.push(build(id, new Set()));
  }
  return roots;
}

// Distinct nodes: one with several parents counts once.
export function countNodes(trees: TreeNode[]): number {
  const seen = new Set<string>();
  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      seen.add(node.term.value);
      visit(node.children);
    }
  };
  visit(trees);
  return seen.size;
}

// The path from a root down to the first match, depth first: where it first shows in the sidebar.
export function findTrail(
  trees: TreeNode[],
  isTarget: (node: TreeNode) => boolean,
): TreeNode[] | undefined {
  for (const node of trees) {
    if (isTarget(node)) return [node];
    const below = findTrail(node.children, isTarget);
    if (below) return [node, ...below];
  }
  return undefined;
}
