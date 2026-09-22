import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { runPreprocessorsDeduped, type Preprocessor } from "@/preprocess/index.ts";
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
