import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.6.5 sh:lessThanOrEquals",
  component: ShaclRenderer,
};

export const shLessThanOrEqualsA: Story = {
  name: "Satisfied (minAge == maxAge)",
  args: argsByTestFile("7.6.5.a sh-less-than-or-equals.ttl", import.meta.url),
};

export const shLessThanOrEqualsB: Story = {
  name: "Violated (minAge > maxAge)",
  args: argsByTestFile("7.6.5.b sh-less-than-or-equals.ttl", import.meta.url),
};
