import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { fieldByLabel } from "@/helpers/fieldByLabel.ts";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Spec/7. Core Constraint Components",
  component: ShaclRenderer,
};

export const PredicatePath: Story = {
  name: "7.1.1 sh:class",
  args: argsByTestFile("7.1.1 sh-class.ttl", import.meta.url),
};
