import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.5.1 sh:memberShape",
  component: ShaclRenderer,
};

export const shMemberShapeA: Story = {
  name: "Satisfied (42, 88, 100 all within 0-100)",
  args: argsByTestFile("7.5.1.a sh-member-shape.ttl", import.meta.url),
};

export const shMemberShapeB: Story = {
  name: "Violated (150 exceeds maxInclusive 100)",
  args: argsByTestFile("7.5.1.b sh-member-shape.ttl", import.meta.url),
};
