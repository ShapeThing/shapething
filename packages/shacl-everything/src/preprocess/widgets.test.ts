import { expect, test } from "vite-plus/test";
import { RdfStore } from "rdf-stores";
import { resolveWidgets } from "@/preprocess/widgets.ts";
import { defaultEnvironment, type RawEnvironment } from "@/environment.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import type { Widgets } from "@/widgets/types.ts";

const rawEnvironment = (overrides: Partial<RawEnvironment>): RawEnvironment => ({
  ...defaultEnvironment,
  shapesGraph: RdfStore.createDefault(),
  dataGraph: RdfStore.createDefault(),
  scoresGraph: RdfStore.createDefault(),
  ...overrides,
});

test("resolveWidgets fills in defaultWidgets when the caller supplies none", () => {
  const result = resolveWidgets(rawEnvironment({}));
  expect(result.widgets).toBe(defaultWidgets);
});

test("resolveWidgets leaves a caller-supplied widgets object untouched, even a partial replacement", () => {
  const customWidgets: Widgets = { editors: {}, viewers: {}, groups: {} };
  const result = resolveWidgets(rawEnvironment({ widgets: customWidgets }));
  expect(result.widgets).toBe(customWidgets);
});
