import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.15 shui:TextFieldEditor",
  component: ShaclRenderer,
};

export const shuiTextFieldEditor: Story = {
  name: "xsd:string value",
  args: argsByTestFile("10.1.15 shui-text-field-editor.ttl", import.meta.url),
};
