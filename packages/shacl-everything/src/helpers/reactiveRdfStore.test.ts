import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { getReactivity, makeReactive } from "@/helpers/reactiveRdfStore.ts";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";

test("makeReactive() is still an RdfStore and reads/writes pass through to it", () => {
  const store = RdfStore.createDefault();
  const reactive = makeReactive(store);

  expect(reactive instanceof RdfStore).toBe(true);
  reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  expect(store.getQuads(ex("Alice"), ex("name")).length).toBe(1);
  expect(reactive.getQuads(ex("Alice"), ex("name")).length).toBe(1);
});

test("getReactivity() returns undefined for a plain, unwrapped store", () => {
  expect(getReactivity(RdfStore.createDefault())).toBeUndefined();
});

test("track() records the getQuads patterns read while it runs", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const reactivity = getReactivity(reactive)!;

  const { result, patterns } = reactivity.track(() => {
    reactive.getQuads(ex("Alice"), ex("name"));
    reactive.getQuads(null, ex("parent"), ex("Bob"));
    return "done";
  });

  expect(result).toBe("done");
  expect(patterns).toEqual([
    { subject: ex("Alice"), predicate: ex("name"), object: null, graph: null },
    { subject: null, predicate: ex("parent"), object: ex("Bob"), graph: null },
  ]);
});

test("subscribe() notifies when a write matches one of the given patterns", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const reactivity = getReactivity(reactive)!;

  let notified = 0;
  reactivity.subscribe(
    [{ subject: ex("Alice"), predicate: ex("name"), object: null, graph: null }],
    () => notified++,
  );

  reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  expect(notified).toBe(1);
});

test("subscribe() does not notify for a write to an unrelated subject/predicate", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const reactivity = getReactivity(reactive)!;

  let notified = 0;
  reactivity.subscribe(
    [{ subject: ex("Alice"), predicate: ex("name"), object: null, graph: null }],
    () => notified++,
  );

  reactive.addQuad(factory.quad(ex("Bob"), ex("name"), factory.literal("Bob")));
  reactive.addQuad(factory.quad(ex("Alice"), ex("age"), factory.literal("30")));
  expect(notified).toBe(0);
});

test("subscribe() does not notify when addQuad is a no-op (quad already present)", () => {
  const store = RdfStore.createDefault();
  store.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  const reactive = makeReactive(store);
  const reactivity = getReactivity(reactive)!;

  let notified = 0;
  reactivity.subscribe(
    [{ subject: ex("Alice"), predicate: ex("name"), object: null, graph: null }],
    () => notified++,
  );

  reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  expect(notified).toBe(0);
});

test("subscribe() also fires for removeQuad when it matches", () => {
  const store = RdfStore.createDefault();
  store.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  const reactive = makeReactive(store);
  const reactivity = getReactivity(reactive)!;

  let notified = 0;
  reactivity.subscribe(
    [{ subject: ex("Alice"), predicate: ex("name"), object: null, graph: null }],
    () => notified++,
  );

  reactive.removeQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  expect(notified).toBe(1);
});

test("the unsubscribe function stops further notifications", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const reactivity = getReactivity(reactive)!;

  let notified = 0;
  const unsubscribe = reactivity.subscribe(
    [{ subject: ex("Alice"), predicate: ex("name"), object: null, graph: null }],
    () => notified++,
  );
  unsubscribe();

  reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  expect(notified).toBe(0);
});
