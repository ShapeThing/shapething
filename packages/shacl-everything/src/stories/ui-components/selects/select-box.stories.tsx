import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "UI components/Selects/Select box",
  component: ShaclRenderer,
};

export const SelectBox: Story = {
  args: argsByTestFile("select-box.ttl", import.meta.url),
};
