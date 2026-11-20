import type { BlankNode, NamedNode } from "@rdfjs/types";

type Node = NamedNode | BlankNode;

// One (node, parent) edge from a hierarchy query (shacl/shapeHierarchy.rq, owl/classHierarchy.rq),
// parent unbound for a root.
export type TreeRow = { parent?: Node; propertyCount: { value: string } };

export type TreeNode = {
  term: Node;
  propertyCount: number;
  children: TreeNode[];
};

// Turns hierarchy query rows into a tree; `termOf` picks the row's node (its shape, its class).
// Rows arrive most properties first, and every level keeps row order, so siblings stay sorted. A
// node with several parents appears under each. A subClassOf cycle is cut where it closes, and
// nodes only reachable through a cycle (no root above them) become roots themselves, so every node
// shows up.
export function buildTree<Row extends TreeRow>(
  rows: Row[],
  termOf: (row: Row) => Node,
): TreeNode[] {
  const propertyCounts = new Map<string, number>();
  const terms = new Map<string, Node>();
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const row of rows) {
    const term = termOf(row);
    const { parent, propertyCount } = row;
    terms.set(term.value, term);
    propertyCounts.set(term.value, Number(propertyCount.value));
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
      propertyCount: propertyCounts.get(id)!,
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

// How many distinct nodes these trees hold. A node with several parents appears under each, but
// counts once.
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

// The path from a root down to the first node matching `isTarget` (depth first, in tree order, so
// the first place it shows in the sidebar), that node included. A node with several parents appears
// under each; the first one wins. Undefined when no node matches.
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
