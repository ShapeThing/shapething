import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.7 Logical Constraint Components/7.7.1 sh:not",
  component: ShaclRenderer,
};

export const shNotA: Story = {
  name: "Satisfied (status is not Banned)",
  args: argsByTestFile("7.7.1.a sh-not.ttl", import.meta.url),
};

export const shNotB: Story = {
  name: "Violated (status is Banned)",
  args: argsByTestFile("7.7.1.b sh-not.ttl", import.meta.url),
};
