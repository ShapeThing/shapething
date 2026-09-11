import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:DurationViewer is a ShapeThing-original viewer, the read-only counterpart to st:DurationEditor
// - not part of the SHACL 1.2 Core spec or the shui: extension proposal, so it lives in its own
// stories folder rather than alongside the spec-conformance suite, colocated with its
// implementation (see widget.tsx). Unlike the editor (bound to react-duration-control's
// day/hour/minute/second/millisecond-only units), this viewer formats the full xsd:duration value
// as-is, year/month components included.
export default {
  title: "Specifications/ShapeThing (living document)/Viewers/st:DurationViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stDurationViewer: Story = {
  name: "A warranty period of 2 years and 6 months",
  args: { ...argsByTestFile("st-duration-viewer.ttl", import.meta.url), mode: "view" },
};
