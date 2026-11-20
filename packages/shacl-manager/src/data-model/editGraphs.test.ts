import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import {
  changesSince,
  commitEdit,
  deleteNode,
  editDataGraph,
  importedQuads,
  isDeactivated,
  mintIri,
  ownGraph,
  ownQuads,
  setDeactivated,
  withChanges,
} from "./editGraphs.ts";
import type { DataModel } from "./loadDataModel.ts";

const factory = new DataFactory();
const iri = (value: string) => factory.namedNode(`http://example.org/${value}`);
const owlImports = factory.namedNode("http://www.w3.org/2002/07/owl#imports");
const label = factory.namedNode("http://www.w3.org/2000/01/rdf-schema#label");
const main = iri("main#");
const imported = iri("imported");

function dataModel(): DataModel {
  const store = RdfStore.createDefault();
  store.addQuad(factory.quad(main, owlImports, imported, main));
  store.addQuad(factory.quad(iri("shape"), label, factory.literal("Old"), main));
  store.addQuad(factory.quad(iri("other"), label, factory.literal("Other"), main));
  store.addQuad(factory.quad(iri("shape"), label, factory.literal("Imported"), imported));
  return {
    dataModelIRI: main,
    store,
    prefixes: {},
    ownPrefixes: {},
    importedGraphIRIs: [imported],
    cachedGraphIRIs: [],
    unresolvableGraphIRIs: [],
  };
}

const labels = (model: DataModel, graph = main) =>
  model.store
    .getQuads(iri("shape"), label, null, graph)
    .map((quad) => quad.object.value)
    .sort();

test("an edit form starts from the data model, plus starting quads in its own graph", () => {
  const model = dataModel();
  expect(editDataGraph(model)).toBe(model.store);
  const start = factory.quad(iri("new"), label, factory.literal("New"));
  const graph = editDataGraph(model, [start]);
  expect(graph.getQuads(iri("new"), label, null, main)).toHaveLength(1);
  expect(graph.size).toBe(5);
  expect(model.store.size).toBe(4);
  expect(
    importedQuads(model)
      .getQuads()
      .map((quad) => quad.graph.value),
  ).toEqual([imported.value]);
});

test("a submitted edit replaces the own graph, moves new quads into it, keeps imported quads", () => {
  const model = dataModel();
  const submitted = RdfStore.createDefault();
  for (const quad of model.store.getQuads()) submitted.addQuad(quad);
  submitted.removeQuad(factory.quad(iri("shape"), label, factory.literal("Old"), main));
  // The renderer writes in the default graph.
  submitted.addQuad(factory.quad(iri("shape"), label, factory.literal("New")));

  const next = commitEdit(model, submitted);
  expect(next.store).not.toBe(model.store);
  expect(labels(next)).toEqual(["New"]);
  expect(labels(next, imported)).toEqual(["Imported"]);
  expect(next.store.getQuads(main, owlImports, imported, main)).toHaveLength(1);
  expect(next.store.getQuads(iri("other"), label, null, main)).toHaveLength(1);
  expect(ownQuads(next).every((quad) => quad.graph.equals(main))).toBe(true);
  expect(labels(model)).toEqual(["Old"]);
});

test("a minted IRI lives in the data model's namespace", () => {
  expect(mintIri(dataModel(), "shape").value).toMatch(
    /^http:\/\/example\.org\/main#shape-[0-9a-f]{8}$/,
  );
});

test("changes are the additions and deletions in the own graph since a snapshot", () => {
  const model = dataModel();
  const saved = ownGraph(model);
  expect(changesSince(saved, model)).toEqual({ additions: [], deletions: [] });

  const submitted = RdfStore.createDefault();
  for (const quad of model.store.getQuads()) submitted.addQuad(quad);
  submitted.removeQuad(factory.quad(iri("shape"), label, factory.literal("Old"), main));
  submitted.addQuad(factory.quad(iri("shape"), label, factory.literal("New")));
  const next = commitEdit(model, submitted);

  const changes = changesSince(saved, next);
  expect(changes.additions.map((quad) => quad.object.value)).toEqual(["New"]);
  expect(changes.deletions.map((quad) => quad.object.value)).toEqual(["Old"]);
  expect(
    [...changes.additions, ...changes.deletions].every((quad) => quad.graph.equals(main)),
  ).toBe(true);
  expect(changesSince(withChanges(saved, changes), next)).toEqual({ additions: [], deletions: [] });
});

const deactivated = factory.namedNode("http://www.w3.org/ns/shacl#deactivated");
const boolean = factory.namedNode("http://www.w3.org/2001/XMLSchema#boolean");

test("setDeactivated disables an imported shape with a triple in the data model's own graph", () => {
  const model = dataModel();
  expect(isDeactivated(model, iri("shape"))).toBe(false);
  const disabled = setDeactivated(model, iri("shape"), true);
  expect(isDeactivated(disabled, iri("shape"))).toBe(true);
  expect(changesSince(ownGraph(model), disabled)).toEqual({
    additions: [factory.quad(iri("shape"), deactivated, factory.literal("true", boolean), main)],
    deletions: [],
  });
  const enabled = setDeactivated(disabled, iri("shape"), false);
  expect(isDeactivated(enabled, iri("shape"))).toBe(false);
  expect(changesSince(ownGraph(model), enabled)).toEqual({ additions: [], deletions: [] });
});

test("setDeactivated enables a shape the import deactivates with sh:deactivated false", () => {
  const model = dataModel();
  model.store.addQuad(
    factory.quad(iri("shape"), deactivated, factory.literal("true", boolean), imported),
  );
  expect(isDeactivated(model, iri("shape"))).toBe(true);
  const enabled = setDeactivated(model, iri("shape"), false);
  expect(isDeactivated(enabled, iri("shape"))).toBe(false);
  expect(changesSince(ownGraph(model), enabled).additions).toEqual([
    factory.quad(iri("shape"), deactivated, factory.literal("false", boolean), main),
  ]);
  expect(isDeactivated(setDeactivated(enabled, iri("shape"), true), iri("shape"))).toBe(true);
  expect(ownQuads(setDeactivated(enabled, iri("shape"), true))).toHaveLength(3);
});

test("deleteNode removes a node, the blank nodes only it uses and the references to it", () => {
  const model = dataModel();
  const property = factory.namedNode("http://www.w3.org/ns/shacl#property");
  const path = factory.namedNode("http://www.w3.org/ns/shacl#path");
  const node = factory.namedNode("http://www.w3.org/ns/shacl#node");
  const shared = factory.blankNode("shared");
  const own = factory.blankNode("own");
  model.store.addQuad(factory.quad(iri("shape"), property, own, main));
  model.store.addQuad(factory.quad(own, path, label, main));
  model.store.addQuad(factory.quad(iri("shape"), property, shared, main));
  model.store.addQuad(factory.quad(iri("other"), property, shared, main));
  model.store.addQuad(factory.quad(shared, path, label, main));
  model.store.addQuad(factory.quad(iri("other"), node, iri("shape"), main));

  const next = deleteNode(model, iri("shape"));
  expect(next.store.getQuads(iri("shape"), null, null, main)).toEqual([]);
  expect(next.store.getQuads(own, null, null, main)).toEqual([]);
  expect(next.store.getQuads(shared, null, null, main)).toHaveLength(1);
  expect(next.store.getQuads(null, null, iri("shape"), main)).toEqual([]);
  // The import's quads about it stay.
  expect(next.store.getQuads(iri("shape"), null, null, imported)).toHaveLength(1);
});
