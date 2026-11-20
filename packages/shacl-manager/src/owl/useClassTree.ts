import { use } from "react";
import { DataFactory } from "rdf-data-factory";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { select } from "../data-model/select.ts";
import { buildTree, type TreeNode } from "../data-model/tree.ts";
import classHierarchy from "./classHierarchy.rq";

export type Origin = "managed" | "imported";

// "hierarchy": named classes, nested by rdfs:subClassOf. "other": anonymous (blank-node) classes.
export type ClassSections = { hierarchy: TreeNode[]; other: TreeNode[] };

const factory = new DataFactory();

// Kept per (store, origin) for as long as the store lives, so use() gets the same promise on every
// render and the queries run only once.
const cache = new WeakMap<RdfStore, Map<Origin, Promise<ClassSections>>>();

async function loadClassSections(
  { store, dataModelIRI }: DataModel,
  origin: Origin,
): Promise<ClassSections> {
  const section = (name: keyof ClassSections) =>
    select(classHierarchy, store, {
      dataModel: dataModelIRI,
      origin: factory.literal(origin),
      section: factory.literal(name),
    }).then((rows) => buildTree(rows, (row) => row.class));
  // Side by side, not one after the other.
  const [hierarchy, other] = await Promise.all([section("hierarchy"), section("other")]);
  return { hierarchy, other };
}

// Suspends until both sidebar sections of this origin are loaded.
export function useClassSections(origin: Origin): ClassSections {
  const dataModel = useDataModel();
  const byOrigin = cache.get(dataModel.store) ?? new Map<Origin, Promise<ClassSections>>();
  cache.set(dataModel.store, byOrigin);
  if (!byOrigin.has(origin)) byOrigin.set(origin, loadClassSections(dataModel, origin));
  return use(byOrigin.get(origin)!);
}
