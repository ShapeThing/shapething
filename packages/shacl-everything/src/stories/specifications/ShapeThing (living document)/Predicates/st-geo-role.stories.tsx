import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:GeoRole is a ShapeThing-original shui:propertyRole value (see resolution/label.ts's
// propertyPathsByRole): it marks which property on a value node's shape holds that value's
// geometry. st:MapViewer walks it from every stop to plot one marker each - hover a marker for its
// shui:LabelRole/shui:ClassificationRole tooltip.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:GeoRole",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stGeoRole: Story = {
  name: "Each stop's geometry resolved via st:GeoRole, plotted on one map",
  args: { ...argsByTestFile("st-geo-role.ttl", import.meta.url), mode: "view" },
};
