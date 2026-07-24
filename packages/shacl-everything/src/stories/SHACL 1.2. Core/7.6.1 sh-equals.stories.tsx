import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.6 Property Pair Constraint Components/7.6.1 sh:equals",
  component: ShaclRenderer,
};

export const shEqualsA: Story = {
  name: "Satisfied (firstName equals givenName)",
  args: argsByTestFile("7.6.1.a sh-equals.ttl", import.meta.url),
};

export const shEqualsB: Story = {
  name: "Violated (firstName differs from givenName)",
  args: argsByTestFile("7.6.1.b sh-equals.ttl", import.meta.url),
};
