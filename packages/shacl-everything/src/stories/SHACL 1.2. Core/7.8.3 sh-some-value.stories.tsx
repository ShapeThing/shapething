import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.8 Shape-based Constraint Components/7.8.3 sh:someValue",
  component: ShaclRenderer,
};

export const shSomeValueA: Story = {
  name: "Satisfied (at least one pet is a Duck)",
  args: argsByTestFile("7.8.3.a sh-some-value.ttl", import.meta.url),
};

export const shSomeValueB: Story = {
  name: "Violated (no pet is a Duck)",
  args: argsByTestFile("7.8.3.b sh-some-value.ttl", import.meta.url),
};
