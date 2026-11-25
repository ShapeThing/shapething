import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import {
  runPreprocessors,
  runPreprocessorsDeduped,
  type Preprocessor,
} from "@/preprocess/index.ts";
import { resolveRdfSources } from "@/preprocess/resolveRdfSources.ts";
import { factory } from "@/helpers/factory.ts";
import { ex } from "@/helpers/namespaces.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";

const rawEnvironment = (overrides: Partial<RawEnvironment> = {}): RawEnvironment => ({
  ...defaultEnvironment,
  // facet mode skips the focusNode/nodeShapes checks in assertValidEnvironment - irrelevant to
  // what's under test here, and defaultEnvironment's own placeholders don't satisfy them.
  mode: "facet",
  shapesGraph: RdfStore.createDefault(),
  dataGraph: RdfStore.createDefault(),
  scoresGraph: RdfStore.createDefault(),
  ...overrides,
});

const countingStep = (calls: { count: number }): Preprocessor => {
  return async (environment) => {
    calls.count++;
    return environment;
  };
};

test("runPreprocessorsDeduped - two concurrent calls with the same RawEnvironment share one run", async () => {
  const calls = { count: 0 };
  const raw = rawEnvironment();
  const steps = [countingStep(calls)];

  const [a, b] = await Promise.all([
    runPreprocessorsDeduped(raw, steps),
    runPreprocessorsDeduped(raw, steps),
  ]);

  expect(calls.count).toBe(1);
  expect(a).toBe(b);
});

test("runPreprocessorsDeduped - a later call (after the first settles) runs again, not cached", async () => {
  const calls = { count: 0 };
  const raw = rawEnvironment();
  const steps = [countingStep(calls)];

  await runPreprocessorsDeduped(raw, steps);
  await runPreprocessorsDeduped(raw, steps);

  expect(calls.count).toBe(2);
});

test("runPreprocessorsDeduped - concurrent calls with different environments don't share a run", async () => {
  const calls = { count: 0 };
  const steps = [countingStep(calls)];

  await Promise.all([
    runPreprocessorsDeduped(rawEnvironment({ interfaceLanguage: "en-GB" }), steps),
    runPreprocessorsDeduped(rawEnvironment({ interfaceLanguage: "nl-NL" }), steps),
  ]);

  expect(calls.count).toBe(2);
});

// A re-preprocess carries its live dataGraph over (keepDataGraph) - resolveRdfSources takes that
// store as it is rather than copying it, since the copy would only be thrown away.
test("runPreprocessors - a kept dataGraph reaches the steps as is, not copied", async () => {
  const live = RdfStore.createDefault();
  live.addQuad(factory.quad(ex("a"), ex("p"), ex("b")));
  let seen: unknown;
  const spy: Preprocessor = (environment) => {
    seen = environment.dataGraph;
    return environment;
  };

  const environment = await runPreprocessors(
    rawEnvironment({ dataGraph: live }),
    [resolveRdfSources, spy],
    {
      keepDataGraph: live,
    },
  );

  expect(seen).toBe(live);
  expect(environment.dataGraph).toBe(live);
});

// Only for that one pass: the same store handed to a renderer as its plain dataGraph is still
// copied, so editing that renderer's dataGraph never writes into the caller's store.
test("runPreprocessors - the same store as a plain dataGraph is still copied", async () => {
  const shared = RdfStore.createDefault();
  shared.addQuad(factory.quad(ex("a"), ex("p"), ex("b")));
  await runPreprocessors(rawEnvironment({ dataGraph: shared }), [resolveRdfSources], {
    keepDataGraph: shared,
  });

  const environment = await runPreprocessors(rawEnvironment({ dataGraph: shared }), [
    resolveRdfSources,
  ]);

  environment.dataGraph.addQuad(factory.quad(ex("a"), ex("p"), ex("c")));

  expect(environment.dataGraph.size).toBe(2);
  expect(shared.size).toBe(1);
});
