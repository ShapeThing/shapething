import { use } from "react";
import { DataFactory } from "rdf-data-factory";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { select } from "../data-model/select.ts";
import { buildTree, type TreeNode } from "../data-model/tree.ts";
import shapeHierarchy from "./shapeHierarchy.rq";

export type Origin = "managed" | "imported";

// "hierarchy": shapes with an sh:targetClass, nested by rdfs:subClassOf. "other": all the rest.
export type ShapeSections = { hierarchy: TreeNode[]; other: TreeNode[] };

const factory = new DataFactory();

// Kept per (store, origin) for as long as the store lives, so use() gets the same promise on every
// render and the queries run only once.
const cache = new WeakMap<RdfStore, Map<Origin, Promise<ShapeSections>>>();

async function loadShapeSections(
  { store, dataModelIRI }: DataModel,
  origin: Origin,
): Promise<ShapeSections> {
  const section = (name: keyof ShapeSections) =>
    select(shapeHierarchy, store, {
      dataModel: dataModelIRI,
      origin: factory.literal(origin),
      section: factory.literal(name),
    }).then((rows) => buildTree(rows, (row) => row.shape));
  // Side by side, not one after the other.
  const [hierarchy, other] = await Promise.all([section("hierarchy"), section("other")]);
  return { hierarchy, other };
}

// Suspends until both sidebar sections of this origin are loaded.
export function useShapeSections(origin: Origin): ShapeSections {
  const dataModel = useDataModel();
  const byOrigin = cache.get(dataModel.store) ?? new Map<Origin, Promise<ShapeSections>>();
  cache.set(dataModel.store, byOrigin);
  if (!byOrigin.has(origin)) byOrigin.set(origin, loadShapeSections(dataModel, origin));
  return use(byOrigin.get(origin)!);
}
