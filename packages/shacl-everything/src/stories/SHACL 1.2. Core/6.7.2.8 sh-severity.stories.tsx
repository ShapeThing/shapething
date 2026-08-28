import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "SHACL 1.2 Core/6. Validation and Graphs/6.7 Validation Report/6.7.2 Validation Result/6.7.2.8 sh:resultSeverity",
  component: ShaclRenderer,
};

export const shSeverityA: Story = {
  name: "sh:Violation (the default when no sh:severity is declared)",
  args: argsByTestFile("6.7.2.8.a sh-severity.ttl", import.meta.url),
};

export const shSeverityB: Story = {
  name: "sh:Warning",
  args: argsByTestFile("6.7.2.8.b sh-severity.ttl", import.meta.url),
};

export const shSeverityC: Story = {
  name: "sh:Info",
  args: argsByTestFile("6.7.2.8.c sh-severity.ttl", import.meta.url),
};
