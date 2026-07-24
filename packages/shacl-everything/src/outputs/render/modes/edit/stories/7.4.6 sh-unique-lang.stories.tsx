import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.4.6 sh:uniqueLang",
  component: ShaclRenderer,
};

export const shUniqueLangA: Story = {
  name: "Satisfied (en, nl each used once)",
  args: argsByTestFile("7.4.6.a sh-unique-lang.ttl", import.meta.url),
};

export const shUniqueLangB: Story = {
  name: "Violated (en used twice)",
  args: argsByTestFile("7.4.6.b sh-unique-lang.ttl", import.meta.url),
};
