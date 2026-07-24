import type { Decorator } from "@storybook/react-vite";
import { addons, useEffect } from "storybook/preview-api";
import { resolveGraphText } from "./resolveGraphText.ts";
import { GRAPH_INSPECTOR_EVENT } from "./constants.ts";
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

    Promise.all([resolveGraphText(shapesGraph as any), resolveGraphText(dataGraph as any)]).then(
      ([shapesGraphText, dataGraphText]) => {
        if (cancelled) return;
        channel.emit(GRAPH_INSPECTOR_EVENT, {
          storyId: context.id,
          shapesGraph: shapesGraphText,
          dataGraph: dataGraphText,
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [shapesGraph, dataGraph, context.id]);

  return Story();
};
