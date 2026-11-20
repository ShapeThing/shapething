import { select } from "@shapething/shacl-renderer";
import { use } from "react";
import type { Origin } from "../app/paths.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { factory } from "../data-model/rdf.ts";
import { cached } from "../data-model/storeCache.ts";
import { buildTree, countNodes, type Sections } from "../data-model/tree.ts";
import classHierarchy from "./queries/classHierarchy.rq";
import { classPropertyTree, propertyIndex } from "./propertyIndex.ts";

// Sorted most properties first, counted as the class's properties tab counts them.
export function classSections({ store, dataModelIRI }: DataModel, origin: Origin) {
  return cached(store, `classSections ${origin}`, async (): Promise<Sections> => {
    const section = async (name: keyof Sections) => {
      const [rows, index] = await Promise.all([
        select(classHierarchy, store, {
          dataModel: dataModelIRI,
          origin: factory.literal(origin),
          section: factory.literal(name),
        }),
        propertyIndex(store),
      ]);
      const counted = rows.map((row) => ({
        ...row,
        propertyCount: { value: String(countNodes(classPropertyTree(index, row.class))) },
      }));
      counted.sort((a, b) => Number(b.propertyCount.value) - Number(a.propertyCount.value));
      return buildTree(counted, (row) => row.class);
    };
    const [hierarchy, other] = await Promise.all([section("hierarchy"), section("other")]);
    return { hierarchy, other };
  });
}

export function useClassSections(origin: Origin): Sections {
  return use(classSections(useDataModel(), origin));
}
