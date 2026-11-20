import type {
  NamedNode,
  Quad,
  Quad_Graph,
  Quad_Object,
  Quad_Predicate,
  Quad_Subject,
  Term,
} from "@rdfjs/types";
import { clear, createStore, get, set } from "idb-keyval";
import type { LoadedGraph } from "./loadDataModel.ts";
import { factory } from "./rdf.ts";

// Imported graphs are published standards: large, slow to dereference and effectively static, so
// they are kept in IndexedDB. The data model's own graph is never cached.

// Bump when CacheEntry changes shape; older entries are then ignored and refetched.
const CACHE_VERSION = 3;

// A failure may have been a network blip, so it is only remembered for a day.
const UNRESOLVABLE_TTL_MS = 24 * 60 * 60 * 1000;

// Created lazily: IndexedDB doesn't exist outside the browser (tests, SSR).
let idbStore: ReturnType<typeof createStore> | undefined;
const getIdbStore = () => (idbStore ??= createStore("shacl-manager", "owl-imports"));

// Compact tuples: structured clone drops the factory's prototypes anyway.
type SerializedTerm =
  | ["N", string]
  | ["B", string]
  | ["L", string, string, string] // value, language, datatype
  | ["D"];
type SerializedQuad = [SerializedTerm, SerializedTerm, SerializedTerm, SerializedTerm];
type CacheEntry =
  | {
      version: number;
      cachedAt: number;
      quads: SerializedQuad[];
      prefixes: Record<string, string>;
    }
  | { version: number; failedAt: number; error: string };

export type CachedImport =
  | { status: "resolved"; quads: Quad[]; prefixes: Record<string, string> }
  | { status: "unresolvable"; error: string };

const serializeTerm = (term: Term): SerializedTerm => {
  switch (term.termType) {
    case "NamedNode":
      return ["N", term.value];
    case "BlankNode":
      return ["B", term.value];
    case "Literal":
      return ["L", term.value, term.language, term.datatype.value];
    case "DefaultGraph":
      return ["D"];
    default:
      throw new Error(`Can not cache a ${term.termType}`);
  }
};

const reviveTerm = (term: SerializedTerm, blankNodePrefix: string): Term => {
  switch (term[0]) {
    case "N":
      return factory.namedNode(term[1]);
    case "B":
      return factory.blankNode(blankNodePrefix + term[1]);
    case "L":
      return factory.literal(term[1], term[2] || factory.namedNode(term[3]));
    case "D":
      return factory.defaultGraph();
  }
};

// Blank node labels are only unique within one parse, so each revived graph gets its own.
let reviveCounter = 0;

export async function readCachedImport(graph: NamedNode): Promise<CachedImport | undefined> {
  const entry = await get<CacheEntry>(graph.value, getIdbStore());
  if (!entry || entry.version !== CACHE_VERSION) return undefined;
  if ("error" in entry) {
    if (Date.now() - entry.failedAt > UNRESOLVABLE_TTL_MS) return undefined;
    return { status: "unresolvable", error: entry.error };
  }
  const prefix = `cached${reviveCounter++}_`;
  const quads = entry.quads.map(([subject, predicate, object, graphTerm]) =>
    factory.quad(
      reviveTerm(subject, prefix) as Quad_Subject,
      reviveTerm(predicate, prefix) as Quad_Predicate,
      reviveTerm(object, prefix) as Quad_Object,
      reviveTerm(graphTerm, prefix) as Quad_Graph,
    ),
  );
  return { status: "resolved", quads, prefixes: entry.prefixes };
}

export async function writeCachedImport(
  graph: NamedNode,
  { quads, prefixes }: LoadedGraph,
): Promise<void> {
  const entry: CacheEntry = {
    version: CACHE_VERSION,
    cachedAt: Date.now(),
    prefixes,
    quads: quads.map((quad) => [
      serializeTerm(quad.subject),
      serializeTerm(quad.predicate),
      serializeTerm(quad.object),
      serializeTerm(quad.graph),
    ]),
  };
  await set(graph.value, entry, getIdbStore());
}

export async function writeUnresolvableImport(graph: NamedNode, error: unknown): Promise<void> {
  const entry: CacheEntry = {
    version: CACHE_VERSION,
    failedAt: Date.now(),
    error: error instanceof Error ? error.message : String(error),
  };
  await set(graph.value, entry, getIdbStore());
}

// Forgets every cached import, e.g. after an upstream standard published a new version.
export async function clearImportCache(): Promise<void> {
  await clear(getIdbStore());
}
