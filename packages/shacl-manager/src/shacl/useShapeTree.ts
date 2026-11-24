import { select } from "@shapething/shacl-renderer";
import type { Origin } from "../app/paths.ts";
import type { DataModel } from "../data-model/loadDataModel.ts";
import { factory } from "../data-model/rdf.ts";
import { cached } from "../data-model/storeCache.ts";
import { buildTree, type Sections } from "../data-model/tree.ts";
import shapeHierarchy from "./queries/shapeHierarchy.rq";

export function shapeSections({ store, dataModelIRI }: DataModel, origin: Origin) {
  return cached(store, `shapeSections ${origin}`, async (): Promise<Sections> => {
    const section = (name: keyof Sections) =>
      select(shapeHierarchy, store, {
        dataModel: dataModelIRI,
        origin: factory.literal(origin),
        section: factory.literal(name),
      }).then((rows) => buildTree(rows, (row) => row.shape));
    const [hierarchy, other] = await Promise.all([section("hierarchy"), section("other")]);
    return { hierarchy, other };
  });
}
