import { DataFactory } from "rdf-data-factory";
import { RdfStore } from "rdf-stores";
import { expect, test } from "vitest";
import { commitEdit, editDataGraph, importedQuads, mintIri, ownQuads } from "./editGraphs.ts";
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
