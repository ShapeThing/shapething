import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";
import { snapshotStore } from "@/helpers/snapshotStore.ts";

test("snapshotStore shares the source's dictionary and is unaffected by later writes", () => {
  const store = RdfStore.createDefault();
  const original = factory.quad(ex("a"), ex("p"), factory.literal("A"));
  store.addQuad(original);

  const snapshot = snapshotStore(store);
  expect(snapshot.dictionary).toBe(store.dictionary);

  store.removeQuad(original);
  store.addQuad(factory.quad(ex("a"), ex("p"), factory.literal("B")));

  expect(snapshot.getQuads()).toEqual([original]);
  expect(snapshot.countQuads(ex("a"), null, null, null)).toBe(1);
});
