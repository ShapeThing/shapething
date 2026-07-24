import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.3 Value Range Constraint Components/7.3.4 sh:maxInclusive",
  component: ShaclRenderer,
};

export const shMaxInclusiveA: Story = {
  name: "Satisfied (42 <= 100)",
  args: argsByTestFile("7.3.4.a sh-max-inclusive.ttl", import.meta.url),
};

export const shMaxInclusiveB: Story = {
  name: "Satisfied at boundary (100 <= 100)",
  args: argsByTestFile("7.3.4.b sh-max-inclusive.ttl", import.meta.url),
};
