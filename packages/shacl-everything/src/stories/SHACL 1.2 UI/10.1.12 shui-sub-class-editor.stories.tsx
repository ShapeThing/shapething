import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.12 shui:SubClassEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiSubClassEditor: Story = {
  name: "Select a subclass of a given root class",
  args: argsByTestFile("10.1.12 shui-sub-class-editor.ttl", import.meta.url),
};

export const shuiSubClassEditor2: Story = {
  name: "Cooking methods",
  args: argsByTestFile("10.1.12 shui-sub-class-editor-2.ttl", import.meta.url),
};

export const shuiSubClassEditor3: Story = {
  name: "Cooking methods (single choice, sh:maxCount 1)",
  args: argsByTestFile("10.1.12 shui-sub-class-editor-3.ttl", import.meta.url),
};
