import type { NamedNode } from "@rdfjs/types";
import { select } from "@shapething/shacl-renderer";
import { useDataModel } from "../../data-model/dataModelContext.ts";
import type { DataModel } from "../../data-model/loadDataModel.ts";
import { factory, termKey, type Resource } from "../../data-model/rdf.ts";
import { cached, useCached } from "../../data-model/storeCache.ts";
import { buildTree, type TreeNode } from "../../data-model/tree.ts";
import { classSections } from "../../owl/useClassTree.ts";
import propertyGroups from "../../shacl/queries/propertyGroups.rq";
import type { Origin } from "../paths.ts";
import classesQuery from "./queries/classes.rq";
import shapesQuery from "./queries/shapes.rq";

// The sidebar: one tree of classes with the shapes that target them, from the data model and its
// imports together, and below it what has no class to hang under.
export type Navigation = {
  classes: TreeNode[];
  shapesWithoutClass: TreeNode[];
  groups: TreeNode[];
  anonymousClasses: TreeNode[];
};

export type ClassRow = { class: Resource; parent?: Resource };
export type ShapeRow = {
  shape: Resource;
  class?: Resource;
  propertyCount: { value: string };
  queryCount: { value: string };
  ruleCount: { value: string };
};

type Placement = Pick<TreeNode, "origin" | "source">;

// Managed when the data model's own graph says anything about it, even about an imported term: that
// is the part that can be edited. Otherwise the first import that declares it.
export function placementOf(
  { store, dataModelIRI, importedGraphIRIs }: DataModel,
  term: Resource,
): Placement {
  if (store.countQuads(term, null, null, dataModelIRI) > 0) return { origin: "managed" };
  const source = importedGraphIRIs.find((graph) => store.countQuads(term, null, null, graph) > 0);
  return source ? { origin: "imported", source } : {};
}

const hasManaged = (node: TreeNode): boolean =>
  node.origin === "managed" || node.children.some(hasManaged);

// The classes nested by rdfs:subClassOf, across origins, each with the shapes targeting it first.
// Siblings with something of the data model's own in or below them go first. A shape targeting
// several classes shows under each.
export function buildClassTree(
  classRows: ClassRow[],
  shapeRows: ShapeRow[],
  place: (term: Resource) => Placement,
): Pick<Navigation, "classes" | "shapesWithoutClass"> {
  const shapeNode = (row: ShapeRow): TreeNode => ({
    term: row.shape,
    kind: "shape",
    count: [row.propertyCount, row.queryCount, row.ruleCount].reduce(
      (sum, part) => sum + Number(part.value),
      0,
    ),
    children: [],
    ...place(row.shape),
  });

  const classKeys = new Set(classRows.map((row) => termKey(row.class)));
  const shapesByClass = new Map<string, ShapeRow[]>();
  const placed = new Set<string>();
  for (const row of shapeRows) {
    if (!row.class || !classKeys.has(termKey(row.class))) continue;
    const shapes = shapesByClass.get(termKey(row.class)) ?? [];
    if (!shapes.some((known) => known.shape.equals(row.shape))) shapes.push(row);
    shapesByClass.set(termKey(row.class), shapes);
    placed.add(termKey(row.shape));
  }
  // Shapes without a target class, and those whose target class has no place (a blank node).
  const withoutClass = new Map<string, ShapeRow>();
  for (const row of shapeRows) {
    const key = termKey(row.shape);
    if (!placed.has(key) && !withoutClass.has(key)) withoutClass.set(key, row);
  }

  const complete = (nodes: TreeNode[]): TreeNode[] => {
    const completed = nodes.map((node) => ({
      ...node,
      kind: "class" as const,
      ...place(node.term),
      children: [
        ...(shapesByClass.get(termKey(node.term)) ?? []).map(shapeNode),
        ...complete(node.children),
      ],
    }));
    // Stable: within each group, the query's order stays.
    return [...completed.filter(hasManaged), ...completed.filter((node) => !hasManaged(node))];
  };

  return {
    classes: complete(buildTree(classRows, (row) => row.class)),
    shapesWithoutClass: [...withoutClass.values()].map(shapeNode),
  };
}

// The nodes that match, with the nodes above them as context; below a match only what matches too.
export function filterTree(nodes: TreeNode[], matches: (node: TreeNode) => boolean): TreeNode[] {
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, matches);
    const match = matches(node);
    return match || children.length ? [{ ...node, children, context: !match }] : [];
  });
}

const origins: Origin[] = ["managed", "imported"];

// The same node from both origins once, the managed one kept.
const mergeOrigins = (lists: TreeNode[][]): TreeNode[] => {
  const seen = new Set<string>();
  return lists.flat().filter((node) => {
    const key = termKey(node.term);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function navigation(dataModel: DataModel): Promise<Navigation> {
  const { store, dataModelIRI } = dataModel;
  return cached(store, "navigation", async () => {
    const place = (term: Resource) => placementOf(dataModel, term);

    const [classRows, shapeRows, groupsByOrigin, anonymousByOrigin] = await Promise.all([
      select(classesQuery, store),
      select(shapesQuery, store),
      Promise.all(
        origins.map(async (origin) => {
          const rows = await select(propertyGroups, store, {
            dataModel: dataModelIRI,
            origin: factory.literal(origin),
          });
          return buildTree(rows, (row) => row.group).map((node) => ({
            ...node,
            kind: "group" as const,
            ...place(node.term),
          }));
        }),
      ),
      Promise.all(
        origins.map(async (origin) =>
          (await classSections(dataModel, origin)).other.map((node) => ({
            ...node,
            kind: "class" as const,
            origin,
            source: place(node.term).source,
          })),
        ),
      ),
    ]);

    return {
      ...buildClassTree(classRows, shapeRows, place),
      groups: mergeOrigins(groupsByOrigin),
      anonymousClasses: mergeOrigins(anonymousByOrigin),
    };
  });
}

export function useNavigation(): Navigation {
  return useCached(navigation(useDataModel()));
}

const preferredPrefix = factory.namedNode("http://purl.org/vocab/vann/preferredNamespacePrefix");

// The data model's own short name: the vann:preferredNamespacePrefix it states about itself.
export function ownLabel({ store, dataModelIRI }: DataModel): string | undefined {
  const [quad] = store.getQuads(dataModelIRI, preferredPrefix, null, dataModelIRI);
  return quad?.object.value.trim() || undefined;
}

// A short name for an import: the prefix the data model uses for it, otherwise the last part of
// its IRI without an extension, such as "dcat-ap-nl-SHACL".
export function sourceLabel(graph: NamedNode, prefixes: Record<string, string>): string {
  const iri = graph.value;
  const alias = Object.entries(prefixes).find(
    ([, namespace]) => namespace === iri || namespace === `${iri}#` || namespace === `${iri}/`,
  )?.[0];
  if (alias) return alias;
  const last =
    iri
      .replace(/[#/]+$/, "")
      .split(/[#/]/)
      .pop() ?? iri;
  return last.replace(/\.(ttl|rdf|owl|jsonld|nt|nq|trig|n3|xml)$/i, "") || iri;
}
