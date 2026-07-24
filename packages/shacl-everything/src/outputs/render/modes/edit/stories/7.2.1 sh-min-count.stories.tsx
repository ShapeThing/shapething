import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.2.1 sh:minCount",
  component: ShaclRenderer,
};

export const shMinCountA: Story = {
  name: "Satisfied (1 of 1)",
  args: argsByTestFile("7.2.1.a sh-min-count.ttl", import.meta.url),
};

export const shMinCountB: Story = {
  name: "Unmet (1 of 2 required)",
  args: argsByTestFile("7.2.1.b sh-min-count.ttl", import.meta.url),
};
