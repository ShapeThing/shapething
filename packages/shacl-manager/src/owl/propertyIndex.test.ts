import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import type { TreeNode } from "../data-model/tree.ts";
import { classPropertyTree, loadPropertyIndex } from "./propertyIndex.ts";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const rdfs = (local: string) => factory.namedNode(`http://www.w3.org/2000/01/rdf-schema#${local}`);
const graph = iri("graph");

// Concept: relation (domain Concept) > broader > broaderGeneric, relation > related; inScheme has
// the domain itself; mappingRelation is a sub-property of relation that also says domain Concept, so
// it shows only below relation. loopA <-> loopB is a subPropertyOf cycle below relation. Scheme's
// hasTop has nothing to do with Concept.
const store = RdfStore.createDefault();
const triples: [string, string, string][] = [
  ["relation", "domain", "Concept"],
  ["broader", "subPropertyOf", "relation"],
  ["broaderGeneric", "subPropertyOf", "broader"],
  ["related", "subPropertyOf", "relation"],
  ["inScheme", "domain", "Concept"],
  ["mappingRelation", "subPropertyOf", "relation"],
  ["mappingRelation", "domain", "Concept"],
  ["loopA", "subPropertyOf", "relation"],
  ["loopA", "subPropertyOf", "loopB"],
  ["loopB", "subPropertyOf", "loopA"],
  ["hasTop", "domain", "Scheme"],
];
for (const [s, p, o] of triples) store.addQuad(factory.quad(iri(s), rdfs(p), iri(o), graph));

const shape = (nodes: TreeNode[]): unknown[] =>
  nodes.map(({ term, children }) => {
    const name = term.value.replace("http://example.org/", "");
    return children.length > 0 ? { [name]: shape(children) } : name;
  });

test("a class's properties, with sub-properties nested and cycles cut", async () => {
  const index = await loadPropertyIndex(store);
  expect(shape(classPropertyTree(index, iri("Concept")))).toEqual([
    "inScheme",
    {
      relation: [
        { broader: ["broaderGeneric"] },
        { loopA: ["loopB"] },
        "mappingRelation",
        "related",
      ],
    },
  ]);
  expect(shape(classPropertyTree(index, iri("Scheme")))).toEqual(["hasTop"]);
  expect(classPropertyTree(index, iri("Nothing"))).toEqual([]);
});
