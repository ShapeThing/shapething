export const GRAPH_INSPECTOR_ADDON_ID = "graph-inspector";
export const GRAPH_INSPECTOR_PANEL_ID = `${GRAPH_INSPECTOR_ADDON_ID}/panel`;
export const GRAPH_INSPECTOR_EVENT = `${GRAPH_INSPECTOR_ADDON_ID}/update`;

export type GraphText = {
  label: string;
  href?: string;
  text?: string;
};

export type GraphInspectorPayload = {
  storyId: string;
  shapesGraph?: GraphText;
  dataGraph?: GraphText;
};
