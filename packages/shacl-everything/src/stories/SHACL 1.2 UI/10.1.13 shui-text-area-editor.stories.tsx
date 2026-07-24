import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.13 shui:TextAreaEditor",
  component: ShaclRenderer,
};

export const shuiTextAreaEditor: Story = {
  name: "Multi-line xsd:string value (sh:singleLine false)",
  args: argsByTestFile("10.1.13 shui-text-area-editor.ttl", import.meta.url),
};
