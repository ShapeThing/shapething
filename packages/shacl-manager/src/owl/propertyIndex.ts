import type { NamedNode } from "@rdfjs/types";
import { select } from "@shapething/shacl-renderer";
import { use } from "react";
import type { RdfStore } from "rdf-stores";
import { useDataModel } from "../data-model/dataModelContext.ts";
import { termKey, type Resource } from "../data-model/rdf.ts";
import { cached } from "../data-model/storeCache.ts";
import { buildTree, type TreeNode } from "../data-model/tree.ts";
import propertyIndexQuery from "./queries/propertyIndex.rq";

export type PropertyIndex = {
  byDomain: Map<string, NamedNode[]>;
  subProperties: Map<string, NamedNode[]>;
  superProperties: Map<string, NamedNode[]>;
};

const push = (map: Map<string, NamedNode[]>, key: string, value: NamedNode) => {
  const list = map.get(key) ?? [];
  if (!list.some((known) => known.equals(value))) list.push(value);
  map.set(key, list);
};

export async function loadPropertyIndex(store: RdfStore): Promise<PropertyIndex> {
  const index: PropertyIndex = {
    byDomain: new Map(),
    subProperties: new Map(),
    superProperties: new Map(),
  };
  for (const { property, domain, superProperty } of await select(propertyIndexQuery, store)) {
    if (domain) push(index.byDomain, termKey(domain), property);
    if (superProperty) {
      push(index.subProperties, termKey(superProperty), property);
      push(index.superProperties, termKey(property), superProperty);
    }
  }
  return index;
}

export const propertyIndex = (store: RdfStore): Promise<PropertyIndex> =>
  cached(store, "propertyIndex", () => loadPropertyIndex(store));

// The properties with rdfs:domain `cls`, with their sub-properties nested below them: under RDFS a
// sub-property has its super-property's domain too. Siblings sort by IRI.
export function classPropertyTree(index: PropertyIndex, cls: Resource): TreeNode[] {
  const reached = new Map<string, NamedNode>();
  const queue = [...(index.byDomain.get(termKey(cls)) ?? [])];
  while (queue.length > 0) {
    const property = queue.shift()!;
    if (reached.has(termKey(property))) continue;
    reached.set(termKey(property), property);
    queue.push(...(index.subProperties.get(termKey(property)) ?? []));
  }

  const rows = [...reached.values()]
    .sort((a, b) => a.value.localeCompare(b.value))
    .flatMap((property): { property: NamedNode; parent?: NamedNode }[] => {
      const parents = (index.superProperties.get(termKey(property)) ?? []).filter((parent) =>
        reached.has(termKey(parent)),
      );
      return parents.length > 0
        ? parents.map((parent) => ({ property, parent }))
        : [{ property, parent: undefined }];
    });
  return buildTree(rows, (row) => row.property);
}

export function useClassPropertyTree(cls: Resource): TreeNode[] {
  const { store } = useDataModel();
  return classPropertyTree(use(propertyIndex(store)), cls);
}
