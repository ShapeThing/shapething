import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/8. Non-Validating Shape Characteristics/8.4 sh:codeIdentifier",
  component: ShaclRenderer,
};

export const shCodeIdentifierA: Story = {
  name: "Explicit sh:codeIdentifier for a non-trivial path",
  args: argsByTestFile("8.4.a sh-code-identifier.ttl", import.meta.url),
};

export const shCodeIdentifierB: Story = {
  name: "No sh:codeIdentifier - falls back to the path's local name",
  args: argsByTestFile("8.4.b sh-code-identifier.ttl", import.meta.url),
};
