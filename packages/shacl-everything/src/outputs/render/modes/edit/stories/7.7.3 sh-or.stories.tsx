import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.7.3 sh:or",
  component: ShaclRenderer,
};

export const shOrA: Story = {
  name: "Satisfied (matches the string branch)",
  args: argsByTestFile("7.7.3.a sh-or.ttl", import.meta.url),
};

export const shOrB: Story = {
  name: "Violated (matches neither branch)",
  args: argsByTestFile("7.7.3.b sh-or.ttl", import.meta.url),
};
