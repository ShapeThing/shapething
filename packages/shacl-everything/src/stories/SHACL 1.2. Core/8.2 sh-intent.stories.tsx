import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 Core/8. Non-Validating Shape Characteristics/8.2 sh:intent",
  component: ShaclRenderer,
};

export const shIntent: Story = {
  name: "Documenting an intended rule that isn't formally validated",
  args: argsByTestFile("8.2 sh-intent.ttl", import.meta.url),
};
