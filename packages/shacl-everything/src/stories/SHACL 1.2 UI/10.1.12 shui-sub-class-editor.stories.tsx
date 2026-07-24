import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.12 shui:SubClassEditor",
  component: ShaclRenderer,
};

export const shuiSubClassEditor: Story = {
  name: "Select a subclass of a given root class",
  args: argsByTestFile("10.1.12 shui-sub-class-editor.ttl", import.meta.url),
};
