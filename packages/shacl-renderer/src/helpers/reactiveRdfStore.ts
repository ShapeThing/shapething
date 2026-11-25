import type { Quad, Term } from "@rdfjs/types";
import { RdfStore } from "rdf-stores";
import { termKey } from "@/helpers/termKey.ts";

/** A getQuads() pattern - a `null` field is a wildcard, matching any term in that position. */
export type Pattern = {
  subject: Term | null;
  predicate: Term | null;
  object: Term | null;
  graph: Term | null;
};

type Subscriber = {
  patterns: Pattern[];
  listener: () => void;
  // Subscription order: listeners still fire in the order they subscribed, as they did before
  // subscribers were indexed (see makeReactive's notify).
  order: number;
  // The index buckets this subscriber is currently filed under (see indexKey).
  keys: string[];
};

export type Reactivity = {
  /** Runs `read`, recording every getQuads() pattern this store sees while it runs. */
  track: <T>(read: () => T) => { result: T; patterns: Pattern[] };
  /** Calls `listener` for every future write whose quad matches at least one of `patterns`. */
  subscribe: (patterns: Pattern[], listener: () => void) => () => void;
  /**
   * For a caller that updates a subscribed `patterns` array in place (see useReactiveRead) rather
   * than re-subscribing: re-files its subscriber(s) under the array's new contents. Without this a
   * write matching only a newly added pattern would go unnoticed.
   */
  patternsChanged: (patterns: Pattern[]) => void;
};

/** One inverse write - the operation that undoes a single addQuad()/removeQuad() call. */
export type QuadEntry = { type: "add" | "remove"; quad: Quad };
/**
 * A non-RDF side effect paired with its own inverse, recorded via History.effect() alongside
 * ordinary quad entries - for state a transaction changes that isn't itself a dataGraph write
 * (e.g. a language switcher's own local "available languages" list), so it stays in sync with
 * whatever undo/redo just did to the graph instead of quietly drifting out of step with it.
 */
export type EffectEntry = { type: "effect"; undo: () => void; redo: () => void };
export type HistoryEntry = QuadEntry | EffectEntry;
/** A group of HistoryEntry undone/redone together as one step, in the order they were made. */
export type Transaction = HistoryEntry[];

export type History = {
  /**
   * Runs `fn`; every addQuad()/removeQuad() made synchronously inside it - including through
   * nested transaction() calls - is grouped into a single undo() / redo() step. A mutation made
   * outside of transaction() still gets its own one-entry step, so wrapping is an optimization for
   * grouping multi-quad gestures, not a requirement for undo to see a write at all.
   */
  transaction: <T>(fn: () => T) => T;
  /**
   * Adds a non-RDF side effect to whatever transaction() is currently running (or its own
   * one-entry step, same as a bare quad write, if called outside one) - `undo`/`redo` run instead
   * of a quad add/remove when this step is undone/redone.
   */
  effect: (callbacks: { undo: () => void; redo: () => void }) => void;
  /**
   * Runs `fn` without recording any of its writes - they still notify subscribers, they just never
   * become an undo()/redo() step of their own, nor part of a surrounding transaction(). For writes
   * that set up the starting state rather than being an edit the user made (e.g. seeding a new
   * resource's sh:defaultValue values, see EditModeWrapper) - undoing those would be undoing past
   * the point the user started from.
   */
  untracked: <T>(fn: () => T) => T;
  /** Undoes the most recent step. Returns false (a no-op) if there was nothing to undo. */
  undo: () => boolean;
  /** Redoes the most recently undone step. Returns false (a no-op) if there was nothing to redo. */
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

const reactivityByStore = new WeakMap<RdfStore, Reactivity>();
const historyByStore = new WeakMap<RdfStore, History>();

function matches(pattern: Pattern, quad: Quad): boolean {
  return (
    (!pattern.subject || pattern.subject.equals(quad.subject)) &&
    (!pattern.predicate || pattern.predicate.equals(quad.predicate)) &&
    (!pattern.object || pattern.object.equals(quad.object)) &&
    (!pattern.graph || pattern.graph.equals(quad.graph))
  );
}

// Which index bucket a pattern is filed under: its most selective bound position - a subscriber
// is only ever checked against a write whose quad shares that term, or, for an all-wildcard
// pattern, against every write. The full pattern is still matched afterwards; the bucket only
// narrows down which subscribers are worth matching at all.
function indexKey(pattern: Pattern): string {
  if (pattern.subject) return `s ${termKey(pattern.subject)}`;
  if (pattern.predicate) return `p ${termKey(pattern.predicate)}`;
  if (pattern.object) return `o ${termKey(pattern.object)}`;
  if (pattern.graph) return `g ${termKey(pattern.graph)}`;
  return "*";
}

function quadIndexKeys(quad: Quad): string[] {
  return [
    `s ${termKey(quad.subject)}`,
    `p ${termKey(quad.predicate)}`,
    `o ${termKey(quad.object)}`,
    `g ${termKey(quad.graph)}`,
    "*",
  ];
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
  // Subscribers filed by indexKey, so a write only matches against the subscribers that could
  // possibly care about it - not against every pattern every component on the page tracks.
  const index = new Map<string, Set<Subscriber>>();
  // Subscribers by their patterns array, for patternsChanged().
  const byPatterns = new Map<Pattern[], Set<Subscriber>>();
  let nextOrder = 0;

  function file(subscriber: Subscriber) {
    subscriber.keys = [...new Set(subscriber.patterns.map(indexKey))];
    for (const key of subscriber.keys) {
      let bucket = index.get(key);
      if (!bucket) index.set(key, (bucket = new Set()));
      bucket.add(subscriber);
    }
  }

  function unfile(subscriber: Subscriber) {
    for (const key of subscriber.keys) {
      const bucket = index.get(key);
      bucket?.delete(subscriber);
      if (bucket?.size === 0) index.delete(key);
    }
    subscriber.keys = [];
  }

  function notify(quad: Quad) {
    const candidates: Subscriber[] = [];
    const seen = new Set<Subscriber>();
    for (const key of quadIndexKeys(quad)) {
      for (const subscriber of index.get(key) ?? []) {
        if (!seen.has(subscriber)) {
          seen.add(subscriber);
          candidates.push(subscriber);
        }
      }
    }
    if (candidates.length > 1) candidates.sort((a, b) => a.order - b.order);
    for (const subscriber of candidates) {
      // A listener earlier in this same notification may have unsubscribed this one.
      if (!subscribers.has(subscriber)) continue;
      if (subscriber.patterns.some((pattern) => matches(pattern, quad))) subscriber.listener();
    }
  }

  // Undo/redo state. `record()` is called from the addQuad/removeQuad traps below with the
  // inverse of what just happened; undo()/redo() replay entries against `store` directly (not
  // through this Proxy), so a replay is never itself recorded as a new entry.
  let depth = 0;
  let untrackedDepth = 0;
  let buffer: Transaction | null = null;
  const undoStack: Transaction[] = [];
  const redoStack: Transaction[] = [];

  function record(entry: HistoryEntry) {
    if (untrackedDepth > 0) return;
    redoStack.length = 0;
    if (buffer) {
      buffer.push(entry);
    } else {
      undoStack.push([entry]);
    }
  }

  // `entry` already records the operation that undoes what originally happened, so undoing just
  // applies it as-is; redoing needs the opposite - flip a quad add/remove, or call the effect's
  // own `redo` instead of its `undo`.
  function applyEntry(entry: HistoryEntry, direction: "undo" | "redo") {
    if (entry.type === "effect") {
      if (direction === "undo") entry.undo();
      else entry.redo();
      return;
    }
    const op = direction === "undo" ? entry.type : entry.type === "add" ? "remove" : "add";
    if (op === "add") store.addQuad(entry.quad);
    else store.removeQuad(entry.quad);
    notify(entry.quad);
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
          if (added) {
            record({ type: "remove", quad });
            notify(quad);
          }
          return added;
        };
      }

      if (property === "removeQuad") {
        return (quad: Quad) => {
          const removed = target.removeQuad(quad);
          if (removed) {
            record({ type: "add", quad });
            notify(quad);
          }
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
      const subscriber: Subscriber = { patterns, listener, order: nextOrder++, keys: [] };
      subscribers.add(subscriber);
      file(subscriber);
      let sharing = byPatterns.get(patterns);
      if (!sharing) byPatterns.set(patterns, (sharing = new Set()));
      sharing.add(subscriber);
      return () => {
        if (!subscribers.delete(subscriber)) return;
        unfile(subscriber);
        sharing.delete(subscriber);
        if (sharing.size === 0) byPatterns.delete(patterns);
      };
    },
    patternsChanged: (patterns) => {
      for (const subscriber of byPatterns.get(patterns) ?? []) {
        unfile(subscriber);
        file(subscriber);
      }
    },
  });

  historyByStore.set(reactive, {
    transaction: (fn) => {
      const outermost = depth === 0;
      if (outermost) buffer = [];
      depth++;
      try {
        return fn();
      } finally {
        depth--;
        if (outermost) {
          if (buffer!.length > 0) undoStack.push(buffer!);
          buffer = null;
        }
      }
    },
    effect: (callbacks) => {
      record({ type: "effect", ...callbacks });
    },
    untracked: (fn) => {
      untrackedDepth++;
      try {
        return fn();
      } finally {
        untrackedDepth--;
      }
    },
    undo: () => {
      const transaction = undoStack.pop();
      if (!transaction) return false;
      for (let i = transaction.length - 1; i >= 0; i--) applyEntry(transaction[i], "undo");
      redoStack.push(transaction);
      return true;
    },
    redo: () => {
      const transaction = redoStack.pop();
      if (!transaction) return false;
      for (const entry of transaction) applyEntry(entry, "redo");
      undoStack.push(transaction);
      return true;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  });

  return reactive;
}

/** The reactivity controls for a store made reactive via makeReactive(), if it was. */
export function getReactivity(store: RdfStore): Reactivity | undefined {
  return reactivityByStore.get(store);
}

/** The undo/redo controls for a store made reactive via makeReactive(), if it was. */
export function getHistory(store: RdfStore): History | undefined {
  return historyByStore.get(store);
}

/**
 * Runs `fn`, grouping every addQuad()/removeQuad() it makes on `store` into one undo/redo step -
 * see History.transaction(). A plain convenience wrapper for call sites that don't otherwise need
 * `store`'s History object, falling back to just calling `fn()` when `store` isn't reactive (e.g.
 * a plain store in a unit test).
 */
export function transact<T>(store: RdfStore, fn: () => T): T {
  const history = getHistory(store);
  return history ? history.transaction(fn) : fn();
}

/**
 * Runs `fn` with none of its writes on `store` recorded for undo/redo - see History.untracked().
 * Falls back to just calling `fn()` when `store` isn't reactive, same as transact().
 */
export function untracked<T>(store: RdfStore, fn: () => T): T {
  const history = getHistory(store);
  return history ? history.untracked(fn) : fn();
}

/**
 * Records a non-RDF side effect (see History.effect()) against whatever transact() is currently
 * running on `store`, falling back to a silent no-op when `store` isn't reactive - there is no
 * undo/redo to attach the effect to in that case, the same as transact() then just calling `fn()`.
 */
export function recordEffect(
  store: RdfStore,
  effect: { undo: () => void; redo: () => void },
): void {
  getHistory(store)?.effect(effect);
}
