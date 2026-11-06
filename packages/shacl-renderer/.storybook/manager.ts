import { addons } from "storybook/manager-api";
import "./addons/graph-inspector/register.tsx";
import { GRAPH_INSPECTOR_PANEL_ID } from "./addons/graph-inspector/constants.ts";
import "./addons/submit-preview/register.tsx";

addons.setConfig({
  selectedPanel: GRAPH_INSPECTOR_PANEL_ID,
  layout: {
    navSize: 400,
    rightPanelWidth: 800,
    panelPosition: "right",
  },
});
