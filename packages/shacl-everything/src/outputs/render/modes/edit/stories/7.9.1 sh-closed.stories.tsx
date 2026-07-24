import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.9.1 sh:closed, sh:ignoredProperties",
  component: ShaclRenderer,
};

export const shClosedA: Story = {
  name: "Satisfied (only declared and ignored properties present)",
  args: argsByTestFile("7.9.1.a sh-closed.ttl", import.meta.url),
};

export const shClosedB: Story = {
  name: "Violated (familyName is not declared or ignored)",
  args: argsByTestFile("7.9.1.b sh-closed.ttl", import.meta.url),
};
