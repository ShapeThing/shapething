import type { DetectedPattern } from "../../../src/analysis/patterns.ts";
import type { SpecUsage } from "../../../src/analysis/specUsage.ts";

export const GRAPH_INSPECTOR_ADDON_ID = "graph-inspector";
export const GRAPH_INSPECTOR_PANEL_ID = `${GRAPH_INSPECTOR_ADDON_ID}/panel`;
export const GRAPH_INSPECTOR_EVENT = `${GRAPH_INSPECTOR_ADDON_ID}/update`;
// Manager -> preview: the panel's "Shapes graph" toggle was selected for this story, serialize it
// now. Preview -> manager: the result, as a GraphInspectorMaterializedPayload.
export const GRAPH_INSPECTOR_REQUEST_MATERIALIZED_EVENT = `${GRAPH_INSPECTOR_ADDON_ID}/request-materialized`;
export const GRAPH_INSPECTOR_MATERIALIZED_EVENT = `${GRAPH_INSPECTOR_ADDON_ID}/materialized`;

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
  // Whether a materialized shapes graph is available on request (see
  // GraphInspectorMaterializedPayload) - false if preprocessing failed, in which case the panel
  // falls back to source-only display.
  canMaterialize?: boolean;
  // Computed by the library (src/analysis/) from the resolved shapesGraph, over in the preview
  // decorator (withGraphInspector.tsx) - already-serializable results, not a live RdfStore, since
  // this crosses the manager/preview channel boundary.
  specUsage?: SpecUsage[];
  patterns?: DetectedPattern[];
};

// A single turtle serialization of Environment.shapesGraph after running the real preprocessing
// chain (see withGraphInspector.tsx and preprocess/index.ts's runPreprocessors) - as opposed to
// GraphInspectorPayload.shapesGraph's per-file *source* text, this is what the library actually
// renders against: several fixture files merged together, owl:imports resolved,
// addMissingShapes/ontology-label dereferencing applied when those opt-ins are on, etc. Only
// serialized on request rather than on every story load: for a large profile (the RDA-FR
// showcase's ~34k-line shapes graph) pretty-turtle blocks the preview's main thread for seconds.
// `text` is undefined if serialization failed.
export type GraphInspectorMaterializedPayload = {
  storyId: string;
  text?: string;
};
