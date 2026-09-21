import type { DetectedPattern } from "../../../src/analysis/patterns.ts";
import type { SpecUsage } from "../../../src/analysis/specUsage.ts";

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
  // A single turtle serialization of Environment.shapesGraph after running the real preprocessing
  // chain (see withGraphInspector.tsx and preprocess/index.ts's runPreprocessors) - as opposed to
  // shapesGraph's per-file *source* text above, this is what the library actually renders against:
  // several fixture files merged together, owl:imports resolved, addMissingShapes/ontology-label
  // dereferencing applied when those opt-ins are on, etc. Undefined if preprocessing/serialization
  // failed - the panel falls back to source-only display in that case.
  shapesGraphMaterialized?: string;
  // Computed by the library (src/analysis/) from the resolved shapesGraph, over in the preview
  // decorator (withGraphInspector.tsx) - already-serializable results, not a live RdfStore, since
  // this crosses the manager/preview channel boundary.
  specUsage?: SpecUsage[];
  patterns?: DetectedPattern[];
};
