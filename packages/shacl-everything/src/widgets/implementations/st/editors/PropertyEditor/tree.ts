import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { arrayMove } from "@dnd-kit/sortable";
import { factory } from "@/helpers/factory.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { transact } from "@/helpers/reactiveRdfStore.ts";
import { writeOrder } from "@/structure/orderByValues.ts";
import type { PropertyPath } from "@/structure/paths/parsePropertyPath.ts";

/**
 * One row of the PropertyEditor's tree, flattened: a property shape of the edited node shape, or a
 * sh:PropertyGroup that (transitively) holds one. `depth` and `parentId` are what nesting by
 * sh:group amounts to once flattened - the list dnd-kit sorts is this flat array.
 */
export type TreeItem = {
  id: string;
  term: Quad_Subject;
  kind: "property" | "group";
  depth: number;
  parentId: string | null;
};

export type Tree = {
  items: TreeItem[];
  // Every group in the data graph the tree doesn't show - none of this shape's properties sit in
  // it (not even further down) - offered as drop targets to start using one.
  unusedGroups: Quad_Subject[];
};

const orderPath: PropertyPath = { type: "predicate", predicate: sh("order") };

const isNode = (term: Term): term is Quad_Subject =>
  term.termType === "NamedNode" || term.termType === "BlankNode";

function groupOf(node: Term, dataGraph: RdfStore): Quad_Subject | undefined {
  return dataGraph
    .getQuads(node as Quad_Subject, sh("group"))
    .map((quad) => quad.object)
    .find(isNode);
}

// A group whose sh:group chain loops back to itself has no usable parent - it's shown top level
// rather than never at all.
function parentGroupOf(group: Quad_Subject, dataGraph: RdfStore): Quad_Subject | undefined {
  const seen = new Set([termKey(group)]);
  let current = groupOf(group, dataGraph);
  while (current) {
    if (seen.has(termKey(current))) return undefined;
    seen.add(termKey(current));
    current = groupOf(current, dataGraph);
  }
  return groupOf(group, dataGraph);
}

// Same rule the renderer sorts a node's children by (see structure/groupChildren.ts): sh:order,
// absent counting as 0, ties keeping their incoming order.
function byOrder(nodes: Quad_Subject[], dataGraph: RdfStore): Quad_Subject[] {
  const orderOf = (node: Quad_Subject) => {
    const value = parseFloat(dataGraph.getQuads(node, sh("order"))[0]?.object.value ?? "");
    return Number.isNaN(value) ? 0 : value;
  };
  return nodes
    .map((node, index) => ({ node, index, order: orderOf(node) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ node }) => node);
}

/** Every node the data graph uses or declares as a sh:PropertyGroup. */
export function allGroups(dataGraph: RdfStore): Quad_Subject[] {
  const groups = new Map<string, Quad_Subject>();
  for (const quad of dataGraph.getQuads(null, rdf("type"), sh("PropertyGroup"))) {
    groups.set(termKey(quad.subject), quad.subject);
  }
  for (const quad of dataGraph.getQuads(null, sh("group"))) {
    if (isNode(quad.object)) groups.set(termKey(quad.object), quad.object);
  }
  return [...groups.values()];
}

/**
 * `properties` (the edited node shape's sh:property values) nested under their sh:group, each
 * group under its own sh:group in turn, every level sorted by sh:order - the same structure the
 * renderer shows the node shape's form in.
 */
export function readTree(properties: Term[], dataGraph: RdfStore): Tree {
  const children = new Map<string | null, Quad_Subject[]>();
  const kinds = new Map<string, TreeItem["kind"]>();
  const addChild = (parent: Quad_Subject | undefined, child: Quad_Subject) => {
    const key = parent ? termKey(parent) : null;
    children.set(key, [...(children.get(key) ?? []), child]);
  };

  for (const property of properties.filter(isNode)) {
    const key = termKey(property);
    if (kinds.has(key)) continue;
    kinds.set(key, "property");
    let parent = groupOf(property, dataGraph);
    addChild(parent, property);
    // Every group up the chain is in use, and hangs under its own parent group.
    while (parent && !kinds.has(termKey(parent))) {
      kinds.set(termKey(parent), "group");
      const grandParent = parentGroupOf(parent, dataGraph);
      addChild(grandParent, parent);
      parent = grandParent;
    }
  }

  const items: TreeItem[] = [];
  const flatten = (parent: Quad_Subject | null, depth: number) => {
    const parentId = parent ? termKey(parent) : null;
    for (const node of byOrder(children.get(parentId) ?? [], dataGraph)) {
      const id = termKey(node);
      items.push({ id, term: node, kind: kinds.get(id)!, depth, parentId });
      flatten(node, depth + 1);
    }
  };
  flatten(null, 0);

  const unusedGroups = byOrder(
    allGroups(dataGraph).filter((group) => !kinds.has(termKey(group))),
    dataGraph,
  );

  return { items, unusedGroups };
}

/** `items` without the descendants of `id` - a dragged group takes its contents along. */
export function removeChildrenOf(items: TreeItem[], id: string): TreeItem[] {
  const excluded = new Set([id]);
  return items.filter((item) => {
    if (item.parentId !== null && excluded.has(item.parentId)) {
      excluded.add(item.id);
      return false;
    }
    return true;
  });
}

export type Projection = { depth: number; parentId: string | null };

/**
 * Where the dragged row would land if dropped on `overId` right now: its position among the rows,
 * and its depth from how far it's been dragged sideways - clamped so it can only end up inside a
 * group (never a property), and never above the depth of the row that would follow it (it'd
 * otherwise be dropped between a group's children without being in that group). Adapted from
 * dnd-kit's own sortable tree example. `items` must already exclude the active row's children
 * (see removeChildrenOf).
 */
export function getProjection(
  items: TreeItem[],
  activeId: string,
  overId: string,
  dragOffset: number,
  indentationWidth: number,
): Projection | undefined {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex === -1 || overIndex === -1) return undefined;

  const activeItem = items[activeIndex];
  const moved = arrayMove(items, activeIndex, overIndex);
  const previous: TreeItem | undefined = moved[overIndex - 1];
  const next: TreeItem | undefined = moved[overIndex + 1];

  const maxDepth = previous ? previous.depth + (previous.kind === "group" ? 1 : 0) : 0;
  const minDepth = next ? next.depth : 0;
  const projected = activeItem.depth + Math.round(dragOffset / indentationWidth);
  const depth = Math.min(Math.max(projected, minDepth), maxDepth);

  const parentId = (() => {
    if (depth === 0 || !previous) return null;
    if (depth === previous.depth) return previous.parentId;
    if (depth > previous.depth) return previous.id;
    return (
      moved
        .slice(0, overIndex)
        .reverse()
        .find((item) => item.depth === depth)?.parentId ?? null
    );
  })();

  return { depth, parentId };
}

function setGroup(node: Quad_Subject, group: Quad_Subject | undefined, dataGraph: RdfStore) {
  for (const quad of dataGraph.getQuads(node, sh("group"))) dataGraph.removeQuad(quad);
  if (group) dataGraph.addQuad(factory.quad(node, sh("group"), group));
}

/**
 * Drops the row `activeId` onto `overId` at `projection`, as one undo step: it moves into the
 * projected parent group (sh:group), and its new siblings there are renumbered 1..n (sh:order) in
 * their new order. `items` is the full tree, children included.
 */
export function moveItem(
  items: TreeItem[],
  activeId: string,
  overId: string,
  projection: Projection,
  dataGraph: RdfStore,
): void {
  const flattened = removeChildrenOf(items, activeId);
  const activeIndex = flattened.findIndex((item) => item.id === activeId);
  const overIndex = flattened.findIndex((item) => item.id === overId);
  if (activeIndex === -1 || overIndex === -1) return;

  const moved = arrayMove(flattened, activeIndex, overIndex).map((item) =>
    item.id === activeId ? { ...item, parentId: projection.parentId } : item,
  );
  const active = moved[overIndex];
  const parent = moved.find((item) => item.id === projection.parentId);
  const siblings = moved.filter((item) => item.parentId === projection.parentId);

  transact(dataGraph, () => {
    setGroup(active.term, parent?.term, dataGraph);
    writeOrder(
      siblings.map((item) => item.term),
      orderPath,
      dataGraph,
    );
  });
}

/**
 * Whether `node` can be put in `group` without creating a sh:group cycle - i.e. `group` isn't
 * `node` itself or somewhere inside it.
 */
export function canMoveInto(node: Quad_Subject, group: Quad_Subject, dataGraph: RdfStore) {
  const seen = new Set<string>();
  let current: Quad_Subject | undefined = group;
  while (current && !seen.has(termKey(current))) {
    if (current.equals(node)) return false;
    seen.add(termKey(current));
    current = groupOf(current, dataGraph);
  }
  return true;
}

/**
 * Puts `node` into an as yet unused `group`, first in line there - one undo step. No-op when that
 * would make a group contain itself (see canMoveInto).
 */
export function moveIntoGroup(node: Quad_Subject, group: Quad_Subject, dataGraph: RdfStore) {
  if (!canMoveInto(node, group, dataGraph)) return;
  transact(dataGraph, () => {
    setGroup(node, group, dataGraph);
    writeOrder([node], orderPath, dataGraph);
  });
}

/** The sh:order that puts a new node after every one of `siblings`. */
export function nextOrder(siblings: Term[], dataGraph: RdfStore): number {
  const orders = siblings
    .filter(isNode)
    .map((node) => parseFloat(dataGraph.getQuads(node, sh("order"))[0]?.object.value ?? ""))
    .filter((value) => !Number.isNaN(value));
  return orders.length ? Math.floor(Math.max(...orders)) + 1 : 1;
}

// Removes every statement about `node`, and about any blank node only reachable through them (e.g.
// a group's st:color [ ... ]).
function removeNode(node: Quad_Subject, dataGraph: RdfStore, seen = new Set<string>()) {
  if (seen.has(termKey(node))) return;
  seen.add(termKey(node));
  for (const quad of dataGraph.getQuads(node)) {
    dataGraph.removeQuad(quad);
    const { object } = quad;
    if (object.termType === "BlankNode" && dataGraph.getQuads(null, null, object).length === 0) {
      removeNode(object, dataGraph, seen);
    }
  }
}

/**
 * Deletes `group` as one undo step: its own statements, and every sh:group statement pointing at
 * it - whatever was in it (properties, other groups) is left without a group.
 */
export function deleteGroup(group: Quad_Subject, dataGraph: RdfStore): void {
  transact(dataGraph, () => {
    for (const quad of dataGraph.getQuads(null, sh("group"), group)) dataGraph.removeQuad(quad);
    removeNode(group, dataGraph);
  });
}

/**
 * The node shapes whose sh:property values are in `group` - directly, or in a group nested in it -
 * other than `except` (the shape being edited). What deleting the group would also change.
 */
export function shapesUsingGroup(
  group: Quad_Subject,
  dataGraph: RdfStore,
  except: Term,
): Quad_Subject[] {
  const shapes = new Map<string, Quad_Subject>();
  const seen = new Set([termKey(group)]);
  const queue: Quad_Subject[] = [group];
  while (queue.length) {
    const current = queue.shift()!;
    for (const { subject } of dataGraph.getQuads(null, sh("group"), current)) {
      if (seen.has(termKey(subject))) continue;
      seen.add(termKey(subject));
      queue.push(subject);
      for (const { subject: shape } of dataGraph.getQuads(null, sh("property"), subject)) {
        if (!shape.equals(except)) shapes.set(termKey(shape), shape);
      }
    }
  }
  return [...shapes.values()];
}
