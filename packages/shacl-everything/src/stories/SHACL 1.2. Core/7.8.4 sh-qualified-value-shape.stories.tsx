import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.8 Shape-based Constraint Components/7.8.4 sh:qualifiedValueShape, sh:qualifiedMinCount, sh:qualifiedMaxCount",
  component: ShaclRenderer,
};

export const shQualifiedValueShapeA: Story = {
  name: "Satisfied (at least one parent is Female)",
  args: argsByTestFile("7.8.4.a sh-qualified-value-shape.ttl", import.meta.url),
};

export const shQualifiedValueShapeB: Story = {
  name: "Violated (no parent is Female)",
  args: argsByTestFile("7.8.4.b sh-qualified-value-shape.ttl", import.meta.url),
};
