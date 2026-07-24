import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.6.4 sh:lessThan",
  component: ShaclRenderer,
};

export const shLessThanA: Story = {
  name: "Satisfied (startDate < endDate)",
  args: argsByTestFile("7.6.4.a sh-less-than.ttl", import.meta.url),
};

export const shLessThanB: Story = {
  name: "Violated (startDate > endDate)",
  args: argsByTestFile("7.6.4.b sh-less-than.ttl", import.meta.url),
};
