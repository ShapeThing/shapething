import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.6 Property Pair Constraint Components/7.6.3 sh:subsetOf",
  component: ShaclRenderer,
};

export const shSubsetOfA: Story = {
  name: "Satisfied (favoriteChild is among the children)",
  args: argsByTestFile("7.6.3.a sh-subset-of.ttl", import.meta.url),
};

export const shSubsetOfB: Story = {
  name: "Violated (favoriteChild is not among the children)",
  args: argsByTestFile("7.6.3.b sh-subset-of.ttl", import.meta.url),
};
