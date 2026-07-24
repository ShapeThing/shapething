import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.7.2 sh:and",
  component: ShaclRenderer,
};

export const shAndA: Story = {
  name: "Satisfied (string AND matches pattern)",
  args: argsByTestFile("7.7.2.a sh-and.ttl", import.meta.url),
};

export const shAndB: Story = {
  name: "Violated (string but fails pattern)",
  args: argsByTestFile("7.7.2.b sh-and.ttl", import.meta.url),
};
