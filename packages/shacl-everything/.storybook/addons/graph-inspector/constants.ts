export const GRAPH_INSPECTOR_ADDON_ID = "graph-inspector";
export const GRAPH_INSPECTOR_PANEL_ID = `${GRAPH_INSPECTOR_ADDON_ID}/panel`;
export const GRAPH_INSPECTOR_EVENT = `${GRAPH_INSPECTOR_ADDON_ID}/update`;

export type GraphFileText = {
  label: string;
  href?: string;
  text?: string;
};

// A shapesGraph/dataGraph arg is frequently several fixture files merged into one store (see
// argsByTestFile's multi-filename form) - `files` keeps each source's own text/href separate
// rather than flattening them, since relative IRIs in one file must resolve against *that* file's
// own href, not some other file's.
export type GraphText = {
  files: GraphFileText[];
};

export type GraphInspectorPayload = {
  storyId: string;
  shapesGraph?: GraphText;
  dataGraph?: GraphText;
};
