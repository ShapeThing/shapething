import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:MapViewer is a ShapeThing-original viewer (ported from shacl-renderer's own GeoViewer), not
// part of the SHACL 1.2 Core spec or the shui: extension proposal - it lives in its own stories
// folder rather than alongside the spec-conformance suite. Unlike GeoViewer, it's a multi-viewer
// (see meta.ts's singleUnifiedWidget) plotting every value of the property on one map, not one map
// per value. Hover a marker to see its tooltip - only the landmark value has one, resolved via
// shui:LabelRole/ClassificationRole (see st-map-viewer.ttl's ex:LandmarkShape); the two literal
// values have no separate node to hang a title/classification off of.
export default {
  title: "ShapeThing/Viewers/st:MapViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stMapViewer: Story = {
  name: "Mixed WKT/GeoJSON/st:GeoRole locations, one with a hover tooltip",
  args: { ...argsByTestFile("st-map-viewer.ttl", import.meta.url), mode: "view" },
};

// The other common shape this same st:GeoRole mechanism covers: not several geo-representations on
// one resource's property, but several separate resources (conference sessions), each with its own
// single-valued location - gathered onto one map via the outer schema:subEvent property. Every
// marker has a tooltip here, since every session has its own node to hang st:GeoRole/
// shui:LabelRole/shui:ClassificationRole off of (see st-map-viewer-events.ttl's ex:SessionShape).
export const stMapViewerEvents: Story = {
  name: "Several event resources, each with its own st:GeoRole location",
  args: { ...argsByTestFile("st-map-viewer-events.ttl", import.meta.url), mode: "view" },
};
