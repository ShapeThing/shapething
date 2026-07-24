import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.4 String-based Constraint Components/7.4.4 sh:singleLine",
  component: ShaclRenderer,
};

export const shSingleLineA: Story = {
  name: "Satisfied (no line breaks)",
  args: argsByTestFile("7.4.4.a sh-single-line.ttl", import.meta.url),
};

export const shSingleLineB: Story = {
  name: "Violated (contains a line break)",
  args: argsByTestFile("7.4.4.b sh-single-line.ttl", import.meta.url),
};
