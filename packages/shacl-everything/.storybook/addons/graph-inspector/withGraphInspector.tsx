import type { Decorator } from "@storybook/react-vite";
import { addons, useEffect } from "storybook/preview-api";
import { resolveGraphText } from "./resolveGraphText.ts";
import { resolveGraphStore } from "./resolveGraphStore.ts";
import { GRAPH_INSPECTOR_EVENT } from "./constants.ts";
import { analyzeSpecUsage } from "../../../src/analysis/specUsage.ts";
import { detectPatterns } from "../../../src/analysis/patterns.ts";
import React from "react";

export const withGraphInspector: Decorator = (Story, context) => {
  const { shapesGraph, dataGraph } = context.args as {
    shapesGraph?: unknown;
    dataGraph?: unknown;
  };

  useEffect(() => {
    if (shapesGraph === undefined && dataGraph === undefined) return;

    let cancelled = false;
    const channel = addons.getChannel();

    Promise.all([
      resolveGraphText(shapesGraph as any),
      resolveGraphText(dataGraph as any),
      // Best-effort: a story whose shapesGraph fails to resolve (e.g. an unreachable fixture URL)
      // still gets its raw text shown above, just without the spec-usage/pattern analysis.
      resolveGraphStore(shapesGraph).catch(() => undefined),
    ]).then(([shapesGraphText, dataGraphText, shapesGraphStore]) => {
      if (cancelled) return;
      channel.emit(GRAPH_INSPECTOR_EVENT, {
        storyId: context.id,
        shapesGraph: shapesGraphText,
        dataGraph: dataGraphText,
        specUsage: shapesGraphStore && analyzeSpecUsage(shapesGraphStore),
        patterns: shapesGraphStore && detectPatterns(shapesGraphStore),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [shapesGraph, dataGraph, context.id]);

  return Story();
};
