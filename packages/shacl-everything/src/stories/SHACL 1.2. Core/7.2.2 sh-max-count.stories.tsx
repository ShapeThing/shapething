import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.2 Cardinality Constraint Components/7.2.2 sh:maxCount",
  component: ShaclRenderer,
};

export const shMaxCountA: Story = {
  name: "Single-valued (max 1)",
  args: argsByTestFile("7.2.2.a sh-max-count.ttl", import.meta.url),
};

export const shMaxCountB: Story = {
  name: "Below cap (2 of 3)",
  args: argsByTestFile("7.2.2.b sh-max-count.ttl", import.meta.url),
};
