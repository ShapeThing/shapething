import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.3 Value Range Constraint Components/7.3.2 sh:minInclusive",
  component: ShaclRenderer,
};

export const shMinInclusiveA: Story = {
  name: "Satisfied (42 >= 0)",
  args: argsByTestFile("7.3.2.a sh-min-inclusive.ttl", import.meta.url),
};

export const shMinInclusiveB: Story = {
  name: "Satisfied at boundary (0 >= 0)",
  args: argsByTestFile("7.3.2.b sh-min-inclusive.ttl", import.meta.url),
};
