import type { NamedNode } from "@rdfjs/types";
import { select } from "@shapething/shacl-renderer";
import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import type { Resource } from "../../data-model/rdf.ts";
import type { TreeNode } from "../../data-model/tree.ts";
import { buildClassTree, filterTree, sourceLabel } from "./navigation.ts";
import classesQuery from "./queries/classes.rq";
import shapesQuery from "./queries/shapes.rq";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const local = (term: Resource) => term.value.replace("http://example.org/", "");
const rdfType = factory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const subClassOf = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf");
const owlClass = factory.namedNode("http://www.w3.org/2002/07/owl#Class");
const sh = (name: string) => factory.namedNode(`http://www.w3.org/ns/shacl#${name}`);

const managed = iri("managed");
const imported = iri("imported");

// The imported standard declares Resource ⊃ Dataset and shapes them; the data model adds its own
// subclass and a shape for the imported Dataset. Catalog is only targeted, never declared.
const store = RdfStore.createDefault();
const add = (s: NamedNode, p: NamedNode, o: NamedNode, g: NamedNode) =>
  store.addQuad(factory.quad(s, p, o, g));
for (const [s, p, o, g] of [
  [iri("Resource"), rdfType, owlClass, imported],
  [iri("Dataset"), subClassOf, iri("Resource"), imported],
  [iri("HighValueDataset"), subClassOf, iri("Dataset"), managed],
  [iri("DatasetShape"), sh("targetClass"), iri("Dataset"), imported],
  [iri("CatalogShape"), sh("targetClass"), iri("Catalog"), imported],
  [iri("MyDatasetShape"), sh("targetClass"), iri("Dataset"), managed],
  [iri("MyDatasetShape"), sh("property"), iri("p1"), managed],
  [iri("LicenseShape"), rdfType, sh("NodeShape"), managed],
] as [NamedNode, NamedNode, NamedNode, NamedNode][]) {
  add(s, p, o, g);
}

const place = (term: Resource) =>
  store.countQuads(term, null, null, managed) > 0
    ? { origin: "managed" as const }
    : store.countQuads(term, null, null, imported) > 0
      ? { origin: "imported" as const, source: imported }
      : {};

// Compact form: "kind name origin" -> children.
const outline = (nodes: TreeNode[]): unknown[] =>
  nodes.map((node) => {
    const label = [node.kind, local(node.term), node.origin ?? "-", node.context && "context"]
      .filter(Boolean)
      .join(" ");
    return node.children.length ? { [label]: outline(node.children) } : label;
  });

const navigation = async () =>
  buildClassTree(await select(classesQuery, store), await select(shapesQuery, store), place);

test("one tree across origins: shapes under their class, own subclasses under imported ones", async () => {
  const { classes, shapesWithoutClass } = await navigation();
  expect(outline(classes)).toEqual([
    {
      "class Resource imported": [
        {
          "class Dataset imported": [
            "shape MyDatasetShape managed",
            "shape DatasetShape imported",
            "class HighValueDataset managed",
          ],
        },
      ],
    },
    // Only targeted: no origin, but still a place for its shape.
    { "class Catalog -": ["shape CatalogShape imported"] },
  ]);
  expect(outline(shapesWithoutClass)).toEqual(["shape LicenseShape managed"]);
});

test("filtering keeps the way to a match as context", async () => {
  const { classes } = await navigation();
  expect(outline(filterTree(classes, (node) => node.origin === "managed"))).toEqual([
    {
      "class Resource imported context": [
        {
          "class Dataset imported context": [
            "shape MyDatasetShape managed",
            "class HighValueDataset managed",
          ],
        },
      ],
    },
  ]);
});

test("an import's short name: its prefix, else the end of its IRI", () => {
  const graph = factory.namedNode("https://example.org/shapes/dcat-ap-nl-SHACL.ttl");
  expect(sourceLabel(graph, {})).toBe("dcat-ap-nl-SHACL");
  const dcat = factory.namedNode("http://www.w3.org/ns/dcat");
  expect(sourceLabel(dcat, { dcat: "http://www.w3.org/ns/dcat#" })).toBe("dcat");
});
