import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.9 Other Constraint Components/7.9.2 sh:hasValue",
  component: ShaclRenderer,
};

export const shHasValueA: Story = {
  name: "Satisfied (status is Active)",
  args: argsByTestFile("7.9.2.a sh-has-value.ttl", import.meta.url),
};

export const shHasValueB: Story = {
  name: "Violated (status is not Active)",
  args: argsByTestFile("7.9.2.b sh-has-value.ttl", import.meta.url),
};
