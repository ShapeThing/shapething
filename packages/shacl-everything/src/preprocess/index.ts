import type { Environment, RawEnvironment } from "@/environment.ts";
import { resolveRdfSources } from "@/preprocess/resolveRdfSources.ts";
import {
  distillInterfaceLanguages,
  distillLanguages,
} from "@/preprocess/languages.ts";
import { resolveScoresGraph } from "@/preprocess/scoresGraph.ts";
import { resolveWidgets } from "@/preprocess/widgets.ts";
import {
  addMissingShapes,
  mergeFacetTextSearchProperties,
} from "@/preprocess/shapes.ts";
import { dereferenceMissingPropertyNames } from "@/preprocess/ontologyLabels.ts";
import { assertValidEnvironment } from "@/preprocess/configuration.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";

export type Preprocessor = (
  environment: RawEnvironment,
) => RawEnvironment | Promise<RawEnvironment>;

export const defaultPreprocessors: readonly Preprocessor[] = [
  resolveRdfSources,
  distillLanguages,
  distillInterfaceLanguages,
  resolveWidgets,
  resolveScoresGraph,
  addMissingShapes,
  dereferenceMissingPropertyNames,
  mergeFacetTextSearchProperties,
];

export const runPreprocessors = async (
  raw: RawEnvironment,
  steps: readonly Preprocessor[] = defaultPreprocessors,
): Promise<Environment> => {
  let result = raw;

  for (const step of steps) {
    result = await step(result);
  }

  const environment = assertValidEnvironment(result);
  // Only dataGraph is written to at runtime (e.g. PropertyUIElement.addObject) - shapesGraph and
  // scoresGraph are read-only for the lifetime of an Environment, so they don't need reactivity.
  return { ...environment, dataGraph: makeReactive(environment.dataGraph) };
};

// Distinguishes RawEnvironment field values for runPreprocessorsDeduped's cache key: primitives
// compare by value, objects/functions (RdfStore, URL, RDF/JS terms, a custom Preprocessor array)
// by reference identity via a WeakMap-assigned id, so two calls only collide when built from the
// exact same underlying inputs - never merely equal-looking ones.
const objectIds = new WeakMap<object, number>();
let nextObjectId = 0;
const idFor = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value !== "object" && typeof value !== "function")
    return `${typeof value}:${String(value)}`;
  let id = objectIds.get(value);
  if (id === undefined) {
    id = nextObjectId++;
    objectIds.set(value, id);
  }
  return `obj:${id}`;
};

const buildKey = (raw: RawEnvironment, steps: readonly Preprocessor[]): string =>
  Object.keys(raw)
    .sort()
    .map((key) => `${key}=${idFor((raw as Record<string, unknown>)[key])}`)
    .concat(`__steps=${idFor(steps)}`)
    .join("&");

const inFlight = new Map<string, Promise<Environment>>();

// Two independent callers occasionally resolve the very same RawEnvironment concurrently - e.g.
// Storybook's graph-inspector decorator (withGraphInspector.tsx) resolves its own copy of "the
// environment this story renders" purely to display a debug panel, at the same moment
// EnvironmentContextProvider resolves the real one for the actual render. Both would otherwise
// independently rerun every step, including the network-touching ones (resolveRdfSources,
// dereferenceMissingPropertyNames), doubling real HTTP traffic for no benefit. This shares the
// in-flight promise between such concurrent, identically-keyed calls - but only while it's
// pending: the entry is removed the instant it settles, so a later, genuinely new call (even with
// an object reference reused after in-place mutation) still gets a fresh run, exactly like calling
// runPreprocessors directly would.
export const runPreprocessorsDeduped = (
  raw: RawEnvironment,
  steps: readonly Preprocessor[] = defaultPreprocessors,
): Promise<Environment> => {
  const key = buildKey(raw, steps);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = runPreprocessors(raw, steps);
  inFlight.set(key, promise);
  promise.finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  return promise;
};
