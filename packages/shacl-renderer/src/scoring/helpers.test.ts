import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { createReactiveCache } from "@/scoring/helpers.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";

test("getOrCompute() only calls compute once per store+key", () => {
  const cache = createReactiveCache<number>();
  const store = RdfStore.createDefault();

  let calls = 0;
  const compute = () => {
    calls++;
    return 42;
  };

  expect(cache.getOrCompute(store, "a", compute)).toBe(42);
  expect(cache.getOrCompute(store, "a", compute)).toBe(42);
  expect(calls).toBe(1);
});

test("getOrCompute() computes separately per key", () => {
  const cache = createReactiveCache<string>();
  const store = RdfStore.createDefault();

  expect(cache.getOrCompute(store, "a", () => "a-value")).toBe("a-value");
  expect(cache.getOrCompute(store, "b", () => "b-value")).toBe("b-value");
});

test("getOrCompute() computes separately per store", () => {
  const cache = createReactiveCache<string>();
  const storeA = RdfStore.createDefault();
  const storeB = RdfStore.createDefault();

  let calls = 0;
  const compute = () => {
    calls++;
    return "value";
  };

  cache.getOrCompute(storeA, "key", compute);
  cache.getOrCompute(storeB, "key", compute);
  expect(calls).toBe(2);
});

test("a write to a reactive store clears every cached key for that store", () => {
  const cache = createReactiveCache<number>();
  const store = makeReactive(RdfStore.createDefault());

  let calls = 0;
  const compute = () => ++calls;

  expect(cache.getOrCompute(store, "a", compute)).toBe(1);
  store.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  expect(cache.getOrCompute(store, "a", compute)).toBe(2);
});

test("a non-reactive store still memoizes, just without invalidation", () => {
  const cache = createReactiveCache<number>();
  const store = RdfStore.createDefault();

  let calls = 0;
  const compute = () => ++calls;

  expect(cache.getOrCompute(store, "a", compute)).toBe(1);
  store.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  expect(cache.getOrCompute(store, "a", compute)).toBe(1);
});
