import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.5 List Constraint Components/7.5.2 sh:minListLength",
  component: ShaclRenderer,
};

export const shMinListLengthA: Story = {
  name: "Satisfied (3 >= 2)",
  args: argsByTestFile("7.5.2.a sh-min-list-length.ttl", import.meta.url),
};

export const shMinListLengthB: Story = {
  name: "Violated (1 < 2)",
  args: argsByTestFile("7.5.2.b sh-min-list-length.ttl", import.meta.url),
};
