import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 Core/8. Non-Validating Shape Characteristics/8.6 sh:order",
  component: ShaclRenderer,
};

export const shOrder: Story = {
  name: "Given name (order 0) before Family name (order 1), despite declaration order",
  args: argsByTestFile("8.6 sh-order.ttl", import.meta.url),
};
