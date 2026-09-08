import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:AddressViewer is a ShapeThing-original viewer (ported from shacl-renderer's own
// AddressViewer), not part of the SHACL 1.2 Core spec or the shui: extension proposal - it lives
// in its own stories folder rather than alongside the spec-conformance suite.
export default {
  title: "Specifications/ShapeThing (living document)/Viewers/st:AddressViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stAddressViewer: Story = {
  name: "An address value",
  args: { ...argsByTestFile("st-address-viewer.ttl", import.meta.url), mode: "view" },
};
