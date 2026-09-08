import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { getHistory, getReactivity, makeReactive } from "@/helpers/reactiveRdfStore.ts";
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

test("getHistory() returns undefined for a plain, unwrapped store", () => {
  expect(getHistory(RdfStore.createDefault())).toBeUndefined();
});

test("undo() reverses the most recent addQuad, redo() reapplies it", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const history = getHistory(reactive)!;
  const quad = factory.quad(ex("Alice"), ex("name"), factory.literal("Alice"));

  reactive.addQuad(quad);
  expect(reactive.getQuads(ex("Alice"), ex("name")).length).toBe(1);

  expect(history.undo()).toBe(true);
  expect(reactive.getQuads(ex("Alice"), ex("name")).length).toBe(0);

  expect(history.redo()).toBe(true);
  expect(reactive.getQuads(ex("Alice"), ex("name")).length).toBe(1);
});

test("undo() reverses the most recent removeQuad, redo() reapplies it", () => {
  const store = RdfStore.createDefault();
  const quad = factory.quad(ex("Alice"), ex("name"), factory.literal("Alice"));
  store.addQuad(quad);
  const reactive = makeReactive(store);
  const history = getHistory(reactive)!;

  reactive.removeQuad(quad);
  expect(reactive.getQuads(ex("Alice"), ex("name")).length).toBe(0);

  expect(history.undo()).toBe(true);
  expect(reactive.getQuads(ex("Alice"), ex("name")).length).toBe(1);

  expect(history.redo()).toBe(true);
  expect(reactive.getQuads(ex("Alice"), ex("name")).length).toBe(0);
});

test("undo()/redo() are no-ops (return false) at empty stack bounds", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const history = getHistory(reactive)!;

  expect(history.canUndo()).toBe(false);
  expect(history.canRedo()).toBe(false);
  expect(history.undo()).toBe(false);
  expect(history.redo()).toBe(false);
});

test("transaction() groups every quad written inside it into a single undo/redo step", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const history = getHistory(reactive)!;

  history.transaction(() => {
    reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
    reactive.addQuad(factory.quad(ex("Alice"), ex("age"), factory.literal("30")));
  });
  expect(reactive.getQuads(ex("Alice")).length).toBe(2);

  // One undo() reverts both quads, not just the last one written.
  expect(history.undo()).toBe(true);
  expect(reactive.getQuads(ex("Alice")).length).toBe(0);

  expect(history.redo()).toBe(true);
  expect(reactive.getQuads(ex("Alice")).length).toBe(2);
});

test("a transaction() nested inside another merges into the outer step", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const history = getHistory(reactive)!;

  history.transaction(() => {
    reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
    history.transaction(() => {
      reactive.addQuad(factory.quad(ex("Alice"), ex("age"), factory.literal("30")));
    });
  });
  expect(reactive.getQuads(ex("Alice")).length).toBe(2);

  expect(history.undo()).toBe(true);
  expect(reactive.getQuads(ex("Alice")).length).toBe(0);
  // Only one step was pushed for the whole nested transaction - nothing left to undo further.
  expect(history.canUndo()).toBe(false);
});

test("a fresh write after an undo clears the redo stack", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const history = getHistory(reactive)!;

  reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  history.undo();
  expect(history.canRedo()).toBe(true);

  reactive.addQuad(factory.quad(ex("Bob"), ex("name"), factory.literal("Bob")));
  expect(history.canRedo()).toBe(false);
  expect(history.redo()).toBe(false);
});

test("undo()/redo() replay reactively - a matching subscriber is notified", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const reactivity = getReactivity(reactive)!;
  const history = getHistory(reactive)!;

  let notified = 0;
  reactivity.subscribe(
    [{ subject: ex("Alice"), predicate: ex("name"), object: null, graph: null }],
    () => notified++,
  );

  reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
  expect(notified).toBe(1);

  history.undo();
  expect(notified).toBe(2);

  history.redo();
  expect(notified).toBe(3);
});

test("effect() runs its undo/redo callback instead of a quad add/remove", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const history = getHistory(reactive)!;

  let state = "forward";
  history.effect({
    undo: () => {
      state = "backward";
    },
    redo: () => {
      state = "forward";
    },
  });

  expect(history.undo()).toBe(true);
  expect(state).toBe("backward");

  expect(history.redo()).toBe(true);
  expect(state).toBe("forward");
});

test("an effect() inside transaction() undoes/redoes together with the quads around it", () => {
  const reactive = makeReactive(RdfStore.createDefault());
  const history = getHistory(reactive)!;

  let sideEffectActive = false;
  history.transaction(() => {
    reactive.addQuad(factory.quad(ex("Alice"), ex("name"), factory.literal("Alice")));
    history.effect({
      undo: () => {
        sideEffectActive = false;
      },
      redo: () => {
        sideEffectActive = true;
      },
    });
    sideEffectActive = true;
  });
  expect(reactive.getQuads(ex("Alice")).length).toBe(1);
  expect(sideEffectActive).toBe(true);

  // One undo() reverts both the quad and the side effect together.
  expect(history.undo()).toBe(true);
  expect(reactive.getQuads(ex("Alice")).length).toBe(0);
  expect(sideEffectActive).toBe(false);

  expect(history.redo()).toBe(true);
  expect(reactive.getQuads(ex("Alice")).length).toBe(1);
  expect(sideEffectActive).toBe(true);
});
