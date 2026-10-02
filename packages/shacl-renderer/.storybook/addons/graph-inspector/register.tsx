import { addons, types } from "storybook/manager-api";
import { GRAPH_INSPECTOR_ADDON_ID, GRAPH_INSPECTOR_PANEL_ID } from "./constants.ts";
import { GraphInspectorPanel } from "./Panel.tsx";
import React from "react";

addons.register(GRAPH_INSPECTOR_ADDON_ID, () => {
  addons.add(GRAPH_INSPECTOR_PANEL_ID, {
    type: types.PANEL,
    title: "Turtle",
    match: ({ viewMode }) => viewMode === "story",
    render: ({ active }) => <GraphInspectorPanel active={!!active} />,
  });
});
