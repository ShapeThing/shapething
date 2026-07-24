import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/Spec/7. Core Constraint Components/7.8.5 sh:reifierShape, sh:reificationRequired",
  component: ShaclRenderer,
};

export const shReifierShapeA: Story = {
  name: "Satisfied (age is reified with date and author)",
  args: argsByTestFile("7.8.5.a sh-reifier-shape.ttl", import.meta.url),
};

export const shReifierShapeB: Story = {
  name: "Violated (age has no reifier at all)",
  args: argsByTestFile("7.8.5.b sh-reifier-shape.ttl", import.meta.url),
};
