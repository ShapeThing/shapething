import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.9.5 sh:uniqueValuesFor",
  component: ShaclRenderer,
};

export const shUniqueValuesForA: Story = {
  name: "Satisfied (emails differ across Person instances)",
  args: argsByTestFile("7.9.5.a sh-unique-values-for.ttl", import.meta.url),
};

export const shUniqueValuesForB: Story = {
  name: "Violated (both Person instances share the same email)",
  args: argsByTestFile("7.9.5.b sh-unique-values-for.ttl", import.meta.url),
};
