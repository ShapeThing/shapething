import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:mapMaxZoom on a st:MapViewer property shape: the closest zoom level the map zooms in to when it
// fits its values. Without it a single point is fitted at street level; with 5 it is shown with the
// region around it.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:mapMaxZoom",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stMapMaxZoom: Story = {
  name: "st:mapMaxZoom 5 shows a single point with its region",
  args: { ...argsByTestFile("st-map-max-zoom.ttl", import.meta.url), mode: "view" },
};
