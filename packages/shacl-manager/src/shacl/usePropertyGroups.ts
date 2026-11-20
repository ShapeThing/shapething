import { select } from "@shapething/shacl-renderer";
import { use } from "react";
import type { Origin } from "../app/paths.ts";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { factory } from "../data-model/rdf.ts";
import { cached } from "../data-model/storeCache.ts";
import { buildTree, type TreeNode } from "../data-model/tree.ts";
import propertyGroups from "./queries/propertyGroups.rq";

export function usePropertyGroups(origin: Origin): TreeNode[] {
  const { store, dataModelIRI } = useDataModel();
  return use(
    cached(store, `propertyGroups ${origin}`, () =>
      select(propertyGroups, store, {
        dataModel: dataModelIRI,
        origin: factory.literal(origin),
      }).then((rows) => buildTree(rows, (row) => row.group)),
    ),
  );
}
