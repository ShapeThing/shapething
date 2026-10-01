import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";
import { datasetWithQuads } from "./datasetWithQuads.ts";

const inBase = factory.quad(ex("a"), ex("p"), ex("b"));
const extra = factory.quad(ex("x"), ex("p"), ex("y"));

const view = () => {
  const store = RdfStore.createDefault();
  store.addQuad(inBase);
  return { store, dataset: datasetWithQuads(store.asDataset(), [extra]) };
};

test("datasetWithQuads() matches both the base dataset and the extra quads", () => {
  const { dataset } = view();
  expect(dataset.size).toBe(2);
  expect([...dataset.match(null, ex("p"))]).toEqual([inBase, extra]);
  expect([...dataset.match(ex("x"))]).toEqual([extra]);
  expect(dataset.match(ex("x")).match(null, null, ex("b")).size).toBe(0);
  expect(dataset.has(extra)).toBe(true);
});

test("datasetWithQuads() reads the base dataset live and never writes to it", () => {
  const { store, dataset } = view();
  const later = factory.quad(ex("c"), ex("p"), ex("d"));
  store.addQuad(later);
  expect([...dataset.match(ex("c"))]).toEqual([later]);
  expect(store.getQuads(ex("x"))).toEqual([]);
  expect(() => dataset.add(later)).toThrow();
});
