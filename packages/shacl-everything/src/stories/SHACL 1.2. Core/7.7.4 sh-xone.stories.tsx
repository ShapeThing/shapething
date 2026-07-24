import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.7 Logical Constraint Components/7.7.4 sh:xone",
  component: ShaclRenderer,
};

export const shXoneA: Story = {
  name: "Satisfied (only givenName+familyName branch matches)",
  args: argsByTestFile("7.7.4.a sh-xone.ttl", import.meta.url),
};

export const shXoneB: Story = {
  name: "Violated (both branches match - ambiguous)",
  args: argsByTestFile("7.7.4.b sh-xone.ttl", import.meta.url),
};
