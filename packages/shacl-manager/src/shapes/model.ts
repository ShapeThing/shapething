import type { BlankNode, NamedNode, Term } from "@rdfjs/types";
import type { TypedQuery } from "@shapething/typed-sparql";
import { termKey } from "@/helpers/iri.ts";
import type nodeReferencesQuery from "./nodeReferences.rq";
import type propertyShapesQuery from "./propertyShapes.rq";

export type TargetKind = "class" | "implicitClass" | "node" | "subjectsOf" | "objectsOf";

export const targetKinds: TargetKind[] = [
  "class",
  "implicitClass",
  "node",
  "subjectsOf",
  "objectsOf",
];

export type Target = { kind: TargetKind; target: Term };

export type NodeShape = {
  key: string;
  term: NamedNode | BlankNode;
  targets: Target[];
};

export type NodeShapeIndex = Map<string, NodeShape>;

export type PropertyShape = {
  key: string;
  term: NamedNode | BlankNode;
  path?: Term;
  minCount?: number;
  maxCount?: number;
  order?: number;
  datatype?: NamedNode;
  class?: NamedNode;
  nodeKind?: NamedNode;
};

// nodeShapes.rq binds ?targetKind/?target in only some UNION branches; the generated typing
// can't see that, so rows are typed here with both optional.
type NodeShapeRow = { shape: NamedNode | BlankNode; targetKind?: Term; target?: Term };
type PropertyShapeRow = typeof propertyShapesQuery extends TypedQuery<infer T> ? T : never;
type NodeReferenceRow = typeof nodeReferencesQuery extends TypedQuery<infer T> ? T : never;

const isTargetKind = (value: string): value is TargetKind =>
  (targetKinds as string[]).includes(value);

export function buildNodeShapeIndex(rows: NodeShapeRow[]): NodeShapeIndex {
  const index: NodeShapeIndex = new Map();
  for (const row of rows) {
    const key = termKey(row.shape);
    let shape = index.get(key);
    if (!shape) {
      shape = { key, term: row.shape, targets: [] };
      index.set(key, shape);
    }
    const kind = row.targetKind?.value;
    if (!kind || !row.target || !isTargetKind(kind)) continue;
    const target = row.target;
    if (!shape.targets.some((t) => t.kind === kind && t.target.equals(target))) {
      shape.targets.push({ kind, target });
    }
  }
  return index;
}

/** The classes a shape targets, explicitly or implicitly. */
export function targetClassesOf(shape: NodeShape): NamedNode[] {
  return shape.targets
    .filter(
      (t) =>
        (t.kind === "class" || t.kind === "implicitClass") && t.target.termType === "NamedNode",
    )
    .map((t) => t.target as NamedNode);
}

export function shapesByTargetClass(index: NodeShapeIndex): Map<string, NodeShape[]> {
  const result = new Map<string, NodeShape[]>();
  for (const shape of index.values()) {
    for (const owlClass of targetClassesOf(shape)) {
      const shapes = result.get(owlClass.value) ?? [];
      if (!shapes.includes(shape)) shapes.push(shape);
      result.set(owlClass.value, shapes);
    }
  }
  return result;
}

export type TargetingGroups = Record<"node" | "subjectsOf" | "objectsOf" | "none", NodeShape[]>;

/**
 * Shapes that don't (only) target a class. A shape with both a class target and e.g. a node
 * target is listed in the class tree *and* here. "none" is mostly helper shapes that are only
 * reused through sh:node, such as skosapnl:Concept.
 */
export function groupByTargeting(index: NodeShapeIndex): TargetingGroups {
  const groups: TargetingGroups = { node: [], subjectsOf: [], objectsOf: [], none: [] };
  for (const shape of index.values()) {
    if (shape.targets.length === 0) {
      groups.none.push(shape);
      continue;
    }
    for (const kind of ["node", "subjectsOf", "objectsOf"] as const) {
      if (shape.targets.some((t) => t.kind === kind)) groups[kind].push(shape);
    }
  }
  return groups;
}

const toNumber = (term: Term | undefined) => {
  if (term?.termType !== "Literal") return undefined;
  const value = Number(term.value);
  return Number.isFinite(value) ? value : undefined;
};

const namedNode = (term: Term | undefined) =>
  term?.termType === "NamedNode" ? (term as NamedNode) : undefined;

/** Property shapes per owning node shape key. The first value of each constraint wins. */
export function buildPropertyShapes(rows: PropertyShapeRow[]): Map<string, PropertyShape[]> {
  const byOwner = new Map<string, Map<string, PropertyShape>>();
  for (const row of rows) {
    const ownerKey = termKey(row.owner);
    const shapes = byOwner.get(ownerKey) ?? new Map<string, PropertyShape>();
    byOwner.set(ownerKey, shapes);

    const key = termKey(row.propertyShape);
    const existing = shapes.get(key);
    const next: PropertyShape = {
      key,
      term: row.propertyShape,
      path: existing?.path ?? (row.path?.termType === "Literal" ? undefined : row.path),
      minCount: existing?.minCount ?? toNumber(row.minCount),
      maxCount: existing?.maxCount ?? toNumber(row.maxCount),
      order: existing?.order ?? toNumber(row.order),
      datatype: existing?.datatype ?? namedNode(row.datatype),
      class: existing?.class ?? namedNode(row.class),
      nodeKind: existing?.nodeKind ?? namedNode(row.nodeKind),
    };
    shapes.set(key, next);
  }

  return new Map(
    [...byOwner].map(([owner, shapes]) => [
      owner,
      [...shapes.values()].sort(
        (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.key.localeCompare(b.key),
      ),
    ]),
  );
}

/** sh:node edges between node shapes, by shape key. */
export function buildNodeReferences(rows: NodeReferenceRow[]): Map<string, Term[]> {
  const result = new Map<string, Term[]>();
  for (const row of rows) {
    if (row.node.termType === "Literal") continue;
    const key = termKey(row.shape);
    const nodes = result.get(key) ?? [];
    if (!nodes.some((node) => node.equals(row.node))) nodes.push(row.node);
    result.set(key, nodes);
  }
  return result;
}
