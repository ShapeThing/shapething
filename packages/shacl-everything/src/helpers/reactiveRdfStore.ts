import type { Quad, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";

/** A getQuads() pattern - a `null` field is a wildcard, matching any term in that position. */
export type Pattern = {
  subject: Term | null;
  predicate: Term | null;
  object: Term | null;
  graph: Term | null;
};

type Subscriber = { patterns: Pattern[]; listener: () => void };

export type Reactivity = {
  /** Runs `read`, recording every getQuads() pattern this store sees while it runs. */
  track: <T>(read: () => T) => { result: T; patterns: Pattern[] };
  /** Calls `listener` for every future write whose quad matches at least one of `patterns`. */
  subscribe: (patterns: Pattern[], listener: () => void) => () => void;
};

const reactivityByStore = new WeakMap<RdfStore, Reactivity>();

function matches(pattern: Pattern, quad: Quad): boolean {
  return (
    (!pattern.subject || pattern.subject.equals(quad.subject)) &&
    (!pattern.predicate || pattern.predicate.equals(quad.predicate)) &&
    (!pattern.object || pattern.object.equals(quad.object)) &&
    (!pattern.graph || pattern.graph.equals(quad.graph))
  );
}

/**
 * Wraps `store` so that reads and writes going through the same instance can stay in sync with
 * React without a blanket "re-render everything" on every change: getQuads() calls made inside
 * track() are recorded as patterns, and addQuad()/removeQuad() only notify the subscribers whose
 * recorded patterns the written quad actually matches - a write to one property's value doesn't
 * wake up a component that reads a different, unrelated property from the same store. Every other
 * method (getBindings, asDataset, ...) passes straight through to `store` unchanged, and
 * `reactive instanceof RdfStore` still holds, so this is a drop-in replacement for `store` itself.
 */
export function makeReactive(store: RdfStore): RdfStore {
  let tracking: Pattern[] | null = null;
  const subscribers = new Set<Subscriber>();

  function notify(quad: Quad) {
    for (const subscriber of subscribers) {
      if (subscriber.patterns.some((pattern) => matches(pattern, quad))) subscriber.listener();
    }
  }

  const reactive = new Proxy(store, {
    get(target, property) {
      if (property === "getQuads") {
        return (
          subject?: Term | null,
          predicate?: Term | null,
          object?: Term | null,
          graph?: Term | null,
        ) => {
          tracking?.push({
            subject: subject ?? null,
            predicate: predicate ?? null,
            object: object ?? null,
            graph: graph ?? null,
          });
          return target.getQuads(subject, predicate, object, graph);
        };
      }

      if (property === "addQuad") {
        return (quad: Quad) => {
          const added = target.addQuad(quad);
          if (added) notify(quad);
          return added;
        };
      }

      if (property === "removeQuad") {
        return (quad: Quad) => {
          const removed = target.removeQuad(quad);
          if (removed) notify(quad);
          return removed;
        };
      }

      // Bound to `target`, not the proxy: RdfStore's internals may rely on private class fields,
      // which only exist on the real instance and would throw if accessed with `this` as the proxy.
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  reactivityByStore.set(reactive, {
    track: (read) => {
      const previous = tracking;
      const patterns: Pattern[] = [];
      tracking = patterns;
      try {
        return { result: read(), patterns };
      } finally {
        tracking = previous;
      }
    },
    subscribe: (patterns, listener) => {
      const subscriber: Subscriber = { patterns, listener };
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  });

  return reactive;
}

/** The reactivity controls for a store made reactive via makeReactive(), if it was. */
export function getReactivity(store: RdfStore): Reactivity | undefined {
  return reactivityByStore.get(store);
}
