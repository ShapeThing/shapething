import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.5.3 sh:maxListLength",
  component: ShaclRenderer,
};

export const shMaxListLengthA: Story = {
  name: "Satisfied (2 <= 3)",
  args: argsByTestFile("7.5.3.a sh-max-list-length.ttl", import.meta.url),
};

export const shMaxListLengthB: Story = {
  name: "Violated (4 > 3)",
  args: argsByTestFile("7.5.3.b sh-max-list-length.ttl", import.meta.url),
};
