import type { Decorator } from "@storybook/react-vite";
import { addons, useEffect } from "storybook/preview-api";
import { write } from "@jeswr/pretty-turtle";
import { resolveGraphText } from "./resolveGraphText.ts";
import { resolveGraphStore } from "./resolveGraphStore.ts";
import { GRAPH_INSPECTOR_EVENT } from "./constants.ts";
import { analyzeSpecUsage } from "../../../src/analysis/specUsage.ts";
import { detectPatterns } from "../../../src/analysis/patterns.ts";
import { prefixes } from "../../../src/helpers/namespaces.ts";
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

    // Most fixtures are fetched from a story's own .ttl file (see argsByTestFile.ts) - passing that
    // same URL back as baseIri lets pretty-turtle write relative IRIs back out, same as
    // withSubmitPreview.tsx does for the submit-preview panel.
    const baseIri = shapesGraph instanceof URL ? shapesGraph.href : undefined;

    Promise.all([
      resolveGraphText(shapesGraph as any),
      resolveGraphText(dataGraph as any),
      // Best-effort: a story whose shapesGraph fails to resolve (e.g. an unreachable fixture URL)
      // still gets its raw text shown above, just without the spec-usage/pattern analysis.
      resolveGraphStore(shapesGraph).catch(() => undefined),
    ]).then(async ([shapesGraphText, dataGraphText, shapesGraphStore]) => {
      if (cancelled) return;
      // Best-effort, same as shapesGraphStore above - falls back to source-only display.
      const shapesGraphMaterialized = shapesGraphStore
        ? await write(shapesGraphStore.getQuads(), { ordered: true, prefixes, baseIri }).catch(
            () => undefined,
          )
        : undefined;
      if (cancelled) return;
      channel.emit(GRAPH_INSPECTOR_EVENT, {
        storyId: context.id,
        shapesGraph: shapesGraphText,
        dataGraph: dataGraphText,
        shapesGraphMaterialized,
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
