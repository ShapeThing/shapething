import type { Preprocessor } from "@/preprocess/index.ts";
import { defaultWidgets } from "@/widgets/registry.ts";
import type { Widgets } from "@/widgets/types.ts";

/**
 * The one "which widget set applies" rule: the caller's own `widgets`, or the bundled
 * `defaultWidgets` when none were given at all. resolveWidgets below applies it once during
 * preprocessing; render code that builds structure elements from `Environment.widgets` (typed
 * optional, since RawEnvironment and Environment share the field) goes through this too, so the
 * structure/ layer is always handed a concrete registry and never needs a fallback of its own.
 */
export function resolvedWidgets(widgets: Widgets | undefined): Widgets {
  return widgets ?? defaultWidgets;
}

/**
 * "Our widgets only load when no other widgets are given in the environment": any truthy
 * `environment.widgets` - even a partial replacement built by spreading `defaultWidgets` - skips
 * loading the bundled set entirely. Must run before resolveScoresGraph, which needs
 * environment.widgets already resolved to merge the right editor/viewer scoringGraph rules in.
 */
export const resolveWidgets = ((environment) =>
  environment.widgets
    ? environment
    : { ...environment, widgets: resolvedWidgets(environment.widgets) }) satisfies Preprocessor;
