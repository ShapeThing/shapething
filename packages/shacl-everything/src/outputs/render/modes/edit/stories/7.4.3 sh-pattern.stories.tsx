import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.4.3 sh:pattern",
  component: ShaclRenderer,
};

export const shPatternA: Story = {
  name: "Satisfied (case-insensitive match via sh:flags)",
  args: argsByTestFile("7.4.3.a sh-pattern.ttl", import.meta.url),
};

export const shPatternB: Story = {
  name: "Violated (wrong order)",
  args: argsByTestFile("7.4.3.b sh-pattern.ttl", import.meta.url),
};
