import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.9 Other Constraint Components/7.9.4 sh:rootClass",
  component: ShaclRenderer,
};

export const shRootClassA: Story = {
  name: "Satisfied (Dog is a subclass of Animal)",
  args: argsByTestFile("7.9.4.a sh-root-class.ttl", import.meta.url),
};

export const shRootClassB: Story = {
  name: "Violated (Plant is not a subclass of Animal)",
  args: argsByTestFile("7.9.4.b sh-root-class.ttl", import.meta.url),
};
