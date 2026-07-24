import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.8.2 sh:property",
  component: ShaclRenderer,
};

export const shPropertyA: Story = {
  name: "Satisfied (both property shapes hold)",
  args: argsByTestFile("7.8.2.a sh-property.ttl", import.meta.url),
};

export const shPropertyB: Story = {
  name: "Violated (familyName's property shape fails)",
  args: argsByTestFile("7.8.2.b sh-property.ttl", import.meta.url),
};
