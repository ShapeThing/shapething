import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.3 Value Range Constraint Components/7.3.3 sh:maxExclusive",
  component: ShaclRenderer,
};

export const shMaxExclusiveA: Story = {
  name: "Satisfied (42 < 100)",
  args: argsByTestFile("7.3.3.a sh-max-exclusive.ttl", import.meta.url),
};

export const shMaxExclusiveB: Story = {
  name: "Violated at boundary (100 is not < 100)",
  args: argsByTestFile("7.3.3.b sh-max-exclusive.ttl", import.meta.url),
};
