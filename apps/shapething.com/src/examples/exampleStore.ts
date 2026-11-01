import type { NamedNode, Quad, Source } from "@rdfjs/types";
import type { LocalStore } from "@shapething/localstore";
import { DataFactory, Parser, Store } from "n3";

export const baseUri = new URL("https://shapething.com/examples/");

// One Turtle file per resource, the path relative to the folder becomes the graph IRI.
const examplesFolder = "./recipes-and-chefs/";
const turtleFiles = import.meta.glob<string>("./recipes-and-chefs/**/*.ttl", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const recipesAndChefs = Object.entries(turtleFiles).map(([path, turtle]) => {
  const graph = DataFactory.namedNode(
    new URL(path.replace(examplesFolder, "").replace(/\.ttl$/, ""), baseUri).toString(),
  );
  // The prefixes are kept, so that the files written to a picked folder use them as well.
  const prefixes: Record<string, string> = {};
  const quads = new Parser({ baseIRI: graph.value }).parse(turtle, null, (prefix, namespace) => {
    prefixes[prefix] = namespace.value;
  });
  return { graph, quads, prefixes };
});

let localStore: LocalStore | undefined;
let memoryStore: Store | undefined;
const listeners = new Set<() => void>();

/**
 * Goes up with every change, so that derived things such as a text index know when to rebuild.
 */
export let storeVersion = 0;

const notify = () => {
  storeVersion++;
  for (const listener of listeners) listener();
};

/**
 * Called by the "Loading data" example once a folder has been filled.
 */
export const setLocalStore = (store: LocalStore) => {
  localStore = store;
  notify();
};

/**
 * Replaces a document, every resource has its own graph which is a file in the picked folder.
 */
export const saveDocument = async (graph: NamedNode, quads: Quad[]) => {
  if (localStore) {
    await localStore.replaceGraph(graph, quads);
  } else {
    const store = getExampleStore().source as Store;
    store.removeQuads(store.getQuads(null, null, null, graph));
    store.addQuads(
      quads.map((quad) => DataFactory.quad(quad.subject, quad.predicate, quad.object, graph)),
    );
  }
  notify();
};

export const onStoreChange = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The picked folder when there is one, otherwise an in memory store with the same data.
 */
export const getExampleStore = (): { source: Source; label: string } => {
  if (localStore) return { source: localStore, label: localStore.getFolderName() ?? "LocalStore" };

  memoryStore ??= new Store(
    recipesAndChefs.flatMap(({ graph, quads }) =>
      quads.map((quad) => DataFactory.quad(quad.subject, quad.predicate, quad.object, graph)),
    ),
  );
  return { source: memoryStore, label: "in memory" };
};
