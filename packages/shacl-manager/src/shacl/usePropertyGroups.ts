import { use } from "react";
import { DataFactory } from "rdf-data-factory";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { select } from "../data-model/select.ts";
import { buildTree, type TreeNode } from "../data-model/tree.ts";
import propertyGroups from "./propertyGroups.rq";
import type { Origin } from "./useShapeTree.ts";

const factory = new DataFactory();

// Kept per (store, origin) for as long as the store lives, so use() gets the same promise on every
// render and the query runs only once.
const cache = new WeakMap<RdfStore, Map<Origin, Promise<TreeNode[]>>>();

function loadPropertyGroups({ store, dataModelIRI }: DataModel, origin: Origin) {
  return select(propertyGroups, store, {
    dataModel: dataModelIRI,
    origin: factory.literal(origin),
  }).then((rows) => buildTree(rows, (row) => row.group));
}

// Suspends until the property groups of this origin are loaded. Flat: no group has a parent.
export function usePropertyGroups(origin: Origin): TreeNode[] {
  const dataModel = useDataModel();
  const byOrigin = cache.get(dataModel.store) ?? new Map<Origin, Promise<TreeNode[]>>();
  cache.set(dataModel.store, byOrigin);
  if (!byOrigin.has(origin)) byOrigin.set(origin, loadPropertyGroups(dataModel, origin));
  return use(byOrigin.get(origin)!);
}
