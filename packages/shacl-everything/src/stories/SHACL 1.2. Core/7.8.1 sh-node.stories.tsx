import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.8 Shape-based Constraint Components/7.8.1 sh:node",
  component: ShaclRenderer,
};

export const shNodeA: Story = {
  name: "Satisfied (postalCode is a string)",
  args: argsByTestFile("7.8.1.a sh-node.ttl", import.meta.url),
};

export const shNodeB: Story = {
  name: "Violated (postalCode is an integer, not a string)",
  args: argsByTestFile("7.8.1.b sh-node.ttl", import.meta.url),
};
