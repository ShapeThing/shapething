import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.4 String-based Constraint Components/7.4.5 sh:languageIn",
  component: ShaclRenderer,
};

export const shLanguageInA: Story = {
  name: "Satisfied (en is allowed)",
  args: argsByTestFile("7.4.5.a sh-language-in.ttl", import.meta.url),
};

export const shLanguageInB: Story = {
  name: "Violated (fr is not allowed)",
  args: argsByTestFile("7.4.5.b sh-language-in.ttl", import.meta.url),
};
