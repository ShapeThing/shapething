import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.4 String-based Constraint Components/7.4.1 sh:minLength",
  component: ShaclRenderer,
};

export const shMinLengthA: Story = {
  name: "Satisfied (7 >= 3)",
  args: argsByTestFile("7.4.1.a sh-min-length.ttl", import.meta.url),
};

export const shMinLengthB: Story = {
  name: "Violated (2 < 3)",
  args: argsByTestFile("7.4.1.b sh-min-length.ttl", import.meta.url),
};
