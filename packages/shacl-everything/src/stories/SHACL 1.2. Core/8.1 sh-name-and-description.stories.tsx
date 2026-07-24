import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 Core/8. Non-Validating Shape Characteristics/8.1 sh:name and sh:description",
  component: ShaclRenderer,
};

export const shNameAndDescriptionA: Story = {
  name: "Explicit sh:name and sh:description",
  args: argsByTestFile("8.1.a sh-name-and-description.ttl", import.meta.url),
};

export const shNameAndDescriptionB: Story = {
  name: "No sh:name - falls back to the ontology's rdfs:label",
  args: argsByTestFile("8.1.b sh-name-and-description.ttl", import.meta.url),
};
