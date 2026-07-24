import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.4.2 sh:maxLength",
  component: ShaclRenderer,
};

export const shMaxLengthA: Story = {
  name: "Satisfied (7 <= 10)",
  args: argsByTestFile("7.4.2.a sh-max-length.ttl", import.meta.url),
};

export const shMaxLengthB: Story = {
  name: "Violated (15 > 10)",
  args: argsByTestFile("7.4.2.b sh-max-length.ttl", import.meta.url),
};
