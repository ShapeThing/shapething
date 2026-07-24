import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 Core/8. Non-Validating Shape Characteristics/8.5 sh:unit",
  component: ShaclRenderer,
};

export const shUnit: Story = {
  name: "A decimal value with a unit of measure",
  args: argsByTestFile("8.5 sh-unit.ttl", import.meta.url),
};
