import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/7. Core Constraint Components/7.5 List Constraint Components/7.5.4 sh:uniqueMembers",
  component: ShaclRenderer,
};

export const shUniqueMembersA: Story = {
  name: "Satisfied (red, green, blue all distinct)",
  args: argsByTestFile("7.5.4.a sh-unique-members.ttl", import.meta.url),
};

export const shUniqueMembersB: Story = {
  name: "Violated (red appears twice)",
  args: argsByTestFile("7.5.4.b sh-unique-members.ttl", import.meta.url),
};
