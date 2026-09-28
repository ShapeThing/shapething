import type { Decorator } from "@storybook/react-vite";
import { addons, useEffect } from "storybook/preview-api";
import { write } from "@jeswr/pretty-turtle";
import { resolveGraphText } from "./resolveGraphText.ts";
import {
  GRAPH_INSPECTOR_EVENT,
  GRAPH_INSPECTOR_MATERIALIZED_EVENT,
  GRAPH_INSPECTOR_REQUEST_MATERIALIZED_EVENT,
} from "./constants.ts";
import { analyzeSpecUsage } from "../../../src/analysis/specUsage.ts";
import { detectPatterns } from "../../../src/analysis/patterns.ts";
import { prefixes } from "../../../src/helpers/namespaces.ts";
import { defaultEnvironment } from "../../../src/environment.ts";
import type { RawEnvironment } from "../../../src/environment.ts";
import { runPreprocessorsDeduped, defaultPreprocessors } from "../../../src/preprocess/index.ts";
import type { Preprocessor } from "../../../src/preprocess/index.ts";
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

    // Same merge + preprocess call EnvironmentContextProvider.tsx makes when this exact story
    // actually mounts, so "the shapes graph" here is the real Environment.shapesGraph the library
    // renders against (post resolveRdfSources/addMissingShapes/ontology dereferencing/etc.), not
    // just the raw fixture text merged together. Both this call and EnvironmentContextProvider's
    // own resolve the same story's environment at essentially the same moment - runPreprocessorsDeduped
    // (rather than runPreprocessors directly) lets them share the one in-flight run instead of each
    // independently redoing every step, including the network-touching ones.
    const { preprocessors, ...rawProps } = context.args as Partial<RawEnvironment> & {
      preprocessors?: readonly Preprocessor[];
    };
    const initialEnvironment = { ...defaultEnvironment, ...rawProps } as RawEnvironment;
    const steps = preprocessors ?? defaultPreprocessors;

    // Serialized only when the panel asks for it - see GraphInspectorMaterializedPayload.
    let resolvedEnvironment: Awaited<ReturnType<typeof runPreprocessorsDeduped>> | undefined;
    let materialized: Promise<string | undefined> | undefined;

    Promise.all([
      resolveGraphText(shapesGraph as any),
      resolveGraphText(dataGraph as any),
      // Best-effort: a story whose environment fails to preprocess (e.g. an unreachable fixture
      // URL) still gets its raw text shown above, just without the materialized-graph view or the
      // spec-usage/pattern analysis.
      runPreprocessorsDeduped(initialEnvironment, steps).catch(() => undefined),
    ]).then(([shapesGraphText, dataGraphText, environment]) => {
      if (cancelled) return;
      resolvedEnvironment = environment;
      channel.emit(GRAPH_INSPECTOR_EVENT, {
        storyId: context.id,
        shapesGraph: shapesGraphText,
        dataGraph: dataGraphText,
        canMaterialize: environment !== undefined,
        specUsage: environment && analyzeSpecUsage(environment.shapesGraph),
        patterns: environment && detectPatterns(environment.shapesGraph),
      });
    });

    const onRequestMaterialized = ({ storyId }: { storyId: string }) => {
      if (storyId !== context.id || !resolvedEnvironment) return;
      // Best-effort, same as environment above - falls back to source-only display.
      materialized ??= write(resolvedEnvironment.shapesGraph.getQuads(), {
        ordered: true,
        prefixes,
        baseIri,
      }).catch(() => undefined);
      void materialized.then((text) => {
        if (!cancelled) channel.emit(GRAPH_INSPECTOR_MATERIALIZED_EVENT, { storyId, text });
      });
    };
    channel.on(GRAPH_INSPECTOR_REQUEST_MATERIALIZED_EVENT, onRequestMaterialized);

    return () => {
      cancelled = true;
      channel.off(GRAPH_INSPECTOR_REQUEST_MATERIALIZED_EVENT, onRequestMaterialized);
    };
  }, [shapesGraph, dataGraph, context.id, context.args]);

  return Story();
};
