import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.1.2 sh:datatype",
  component: ShaclRenderer,
};

export const shDatatypeA: Story = {
  name: "xsd:date",
  args: argsByTestFile("7.1.2.a sh-datatype.ttl", import.meta.url),
};

export const shDatatypeB: Story = {
  name: "xsd:integer",
  args: argsByTestFile("7.1.2.b sh-datatype.ttl", import.meta.url),
};
