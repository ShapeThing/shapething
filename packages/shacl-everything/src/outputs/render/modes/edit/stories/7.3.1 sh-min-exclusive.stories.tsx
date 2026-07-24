import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.3.1 sh:minExclusive",
  component: ShaclRenderer,
};

export const shMinExclusiveA: Story = {
  name: "Satisfied (42 > 0)",
  args: argsByTestFile("7.3.1.a sh-min-exclusive.ttl", import.meta.url),
};

export const shMinExclusiveB: Story = {
  name: "Violated at boundary (0 is not > 0)",
  args: argsByTestFile("7.3.1.b sh-min-exclusive.ttl", import.meta.url),
};
