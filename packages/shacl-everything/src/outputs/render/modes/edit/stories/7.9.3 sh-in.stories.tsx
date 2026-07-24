import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.9.3 sh:in",
  component: ShaclRenderer,
};

export const shInA: Story = {
  name: "Satisfied (Active is an allowed value)",
  args: argsByTestFile("7.9.3.a sh-in.ttl", import.meta.url),
};

export const shInB: Story = {
  name: "Violated (Deleted is not an allowed value)",
  args: argsByTestFile("7.9.3.b sh-in.ttl", import.meta.url),
};
