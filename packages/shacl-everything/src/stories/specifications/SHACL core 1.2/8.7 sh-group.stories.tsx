import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/SHACL core 1.2/8. Non-Validating Shape Characteristics/8.7 sh:group",
  component: ShaclRenderer,
};

export const shGroup: Story = {
  name: "Properties grouped into Name and Address sections",
  args: argsByTestFile("8.7 sh-group.ttl", import.meta.url),
};
