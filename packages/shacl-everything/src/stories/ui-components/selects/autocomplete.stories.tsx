import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "UI components/Selects/Autocomplete",
  component: ShaclRenderer,
};

export const Autocomplete: Story = {
  args: argsByTestFile("autocomplete.ttl", import.meta.url),
};
