import { DataFactory } from "rdf-data-factory";
import { expect, test } from "vitest";
import { buildTree, findTrail, type TreeNode } from "./tree.ts";

const factory = new DataFactory();
const row = (node: string, propertyCount: number, parent?: string) => ({
  node: factory.namedNode(node),
  parent: parent ? factory.namedNode(parent) : undefined,
  propertyCount: factory.literal(String(propertyCount)),
});
const tree = (rows: ReturnType<typeof row>[]) => buildTree(rows, (row) => row.node);

// Compact form: name -> children, in order.
const outline = (nodes: TreeNode[]): unknown[] =>
  nodes.map((node) =>
    node.children.length ? { [node.term.value]: outline(node.children) } : node.term.value,
  );

test("keeps row order on every level and repeats a node under each parent", () => {
  const nodes = tree([
    row("Person", 3, "Agent"),
    row("Person", 3, "Mammal"),
    row("Organisation", 2, "Agent"),
    row("Agent", 1),
    row("Mammal", 0),
  ]);
  expect(outline(nodes)).toEqual([{ Agent: ["Person", "Organisation"] }, { Mammal: ["Person"] }]);
});

test("a subClassOf cycle without a root is cut where it closes, so every node still shows", () => {
  const nodes = tree([row("A", 1, "B"), row("B", 1, "A")]);
  expect(outline(nodes)).toEqual([{ A: ["B"] }]);
});

test("findTrail returns the path from a root down to the first occurrence of a node", () => {
  const nodes = tree([
    row("Person", 3, "Agent"),
    row("Person", 3, "Mammal"),
    row("Student", 1, "Person"),
    row("Agent", 1),
    row("Mammal", 0),
  ]);
  const trail = (id: string) =>
    findTrail(nodes, (node) => node.term.value === id)?.map((node) => node.term.value);
  expect(trail("Student")).toEqual(["Agent", "Person", "Student"]);
  expect(trail("Mammal")).toEqual(["Mammal"]);
  expect(trail("Missing")).toBeUndefined();
});
