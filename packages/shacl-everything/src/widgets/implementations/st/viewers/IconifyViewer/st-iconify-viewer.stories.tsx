import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:IconifyViewer is a ShapeThing-original viewer (ported from shacl-renderer's own
// IconifyViewer), not part of the SHACL 1.2 Core spec or the shui: extension proposal - it lives
// in its own stories folder rather than alongside the spec-conformance suite. Renders the icon
// live via @iconify/react's own <Icon/>, so this story depends on a live network call to
// api.iconify.design for the icon's SVG data.
export default {
  title: "Specifications/ShapeThing (living document)/Viewers/st:IconifyViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stIconifyViewer: Story = {
  name: "An Iconify icon name value",
  args: { ...argsByTestFile("st-iconify-viewer.ttl", import.meta.url), mode: "view" },
};
