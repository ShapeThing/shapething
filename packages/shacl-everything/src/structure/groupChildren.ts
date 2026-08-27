import type { Quad_Subject, Term } from "@rdfjs/types";
import type { RdfStore } from "rdf-stores";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { termKey } from "@/helpers/termKey.ts";
import { ChoiceElement } from "@/structure/ChoiceElement.ts";
import { GroupUIElement } from "@/structure/GroupUIElement.ts";
import { PropertyUIElement } from "@/structure/PropertyUIElement.ts";
import type { Widgets } from "@/widgets/types.ts";

type Child = PropertyUIElement | ChoiceElement | GroupUIElement;

/**
 * Buckets a flat list of a shape's children (as returned by NodeUIElement.children()/
 * childrenForShape()) into a tree by sh:group: a PropertyUIElement carrying sh:group nests under
 * the GroupUIElement for that group node, and a group whose own node carries sh:group nests under
 * ITS parent group the same way (nested groups, per shacl-renderer's convention: a group is just
 * another sh:PropertyGroup node pointing at its parent via sh:group). Every level - the top level,
 * and each group's own children - is stably sorted by sh:order, defaulting absent values to 0, so
 * a shapes graph with no sh:order/sh:group at all sorts identically to today's flat, unordered
 * rendering. ChoiceElements are never grouped (mirrors shacl-renderer: sh:or/xone lives at the
 * node level, not inside a group) but still participate in top-level ordering.
 *
 * Shape graphs are assumed acyclic, same as the rest of this codebase (no cycle guard) - see
 * childrenForShape.ts.
 */
export function groupChildren(
  elements: (PropertyUIElement | ChoiceElement)[],
  shapesGraph: RdfStore,
  dataGraph: RdfStore,
  focusNode: Quad_Subject,
  widgets?: Widgets,
): Child[] {
  // Discover every group node reachable from a grouped property's sh:group, walking each group's
  // own sh:group up its ancestor chain - so a nested group is found even when nothing is assigned
  // to it directly, only to a deeper subgroup.
  const groupNodes = new Map<string, Term>();
  const frontier: Term[] = [];
  for (const element of elements) {
    if (element.kind !== "property") continue;
    const groupTerm = element.get(sh("group"));
    if (groupTerm) frontier.push(groupTerm);
  }
  while (frontier.length) {
    const node = frontier.pop()!;
    const key = termKey(node);
    if (groupNodes.has(key)) continue;
    groupNodes.set(key, node);
    const parent = shapesGraph.getQuads(node, sh("group"))[0]?.object;
    if (parent) frontier.push(parent);
  }

  for (const node of groupNodes.values()) {
    if (shapesGraph.getQuads(node, rdf("type"), sh("PropertyGroup")).length === 0) {
      throw new Error(`Missing sh:PropertyGroup definition for ${node.value}`);
    }
  }

  const groups = new Map<string, GroupUIElement>();
  for (const node of groupNodes.values()) {
    groups.set(
      termKey(node),
      new GroupUIElement({
        shapesGraph,
        dataGraph,
        widgetRegistry: widgets,
        focusNode,
        node,
        children: [],
      }),
    );
  }

  const topLevel: Child[] = [];
  for (const element of elements) {
    const groupTerm = element.kind === "property" ? element.get(sh("group")) : undefined;
    const group = groupTerm && groups.get(termKey(groupTerm));
    (group ? group.children : topLevel).push(element);
  }

  for (const group of groups.values()) {
    const parentTerm = shapesGraph.getQuads(group.node, sh("group"))[0]?.object;
    const parent = parentTerm && groups.get(termKey(parentTerm));
    (parent ? parent.children : topLevel).push(group);
  }

  for (const group of groups.values()) {
    group.children = sortByOrder(group.children, shapesGraph);
  }
  return sortByOrder(topLevel, shapesGraph);
}

function order(element: Child, shapesGraph: RdfStore): number {
  if (element.kind === "property") return element.get(sh("order")) ?? 0;

  const node = element.kind === "group" ? element.node : element.shape;
  const value = shapesGraph.getQuads(node, sh("order"))[0]?.object.value;
  const parsed = value !== undefined ? parseFloat(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByOrder(children: Child[], shapesGraph: RdfStore): Child[] {
  return children
    .map((child, index) => ({ child, index, order: order(child, shapesGraph) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ child }) => child);
}
