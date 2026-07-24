import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components/7.6.2 sh:disjoint",
  component: ShaclRenderer,
};

export const shDisjointA: Story = {
  name: "Satisfied (prefLabel and altLabel differ)",
  args: argsByTestFile("7.6.2.a sh-disjoint.ttl", import.meta.url),
};

export const shDisjointB: Story = {
  name: "Violated (prefLabel and altLabel overlap)",
  args: argsByTestFile("7.6.2.b sh-disjoint.ttl", import.meta.url),
};
