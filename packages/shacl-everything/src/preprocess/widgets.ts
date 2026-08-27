import type { Preprocessor } from "@/preprocess/index.ts";
import { defaultWidgets } from "@/widgets/registry.ts";

/**
 * "Our widgets only load when no other widgets are given in the environment": any truthy
 * `environment.widgets` - even a partial replacement built by spreading `defaultWidgets` - skips
 * loading the bundled set entirely. Must run before resolveScoresGraph, which needs
 * environment.widgets already resolved to merge the right editor/viewer scoringGraph rules in.
 */
export const resolveWidgets = ((environment) =>
  environment.widgets
    ? environment
    : { ...environment, widgets: defaultWidgets }) satisfies Preprocessor;
