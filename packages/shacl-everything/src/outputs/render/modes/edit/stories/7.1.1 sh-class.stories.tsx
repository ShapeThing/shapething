import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.1.1 sh:class",
  component: ShaclRenderer,
};

export const shClassA: Story = {
  name: "Plain",
  args: argsByTestFile("7.1.1.a sh-class.ttl", import.meta.url),
};

export const shClassB: Story = {
  name: "InstancesSelectEditor with sh:node and propertyRole",
  args: argsByTestFile("7.1.1.b sh-class.ttl", import.meta.url),
};
