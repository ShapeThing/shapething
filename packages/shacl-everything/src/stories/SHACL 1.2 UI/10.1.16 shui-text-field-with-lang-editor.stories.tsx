import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.16 shui:TextFieldWithLangEditor",
  component: ShaclRenderer,
};

export const shuiTextFieldWithLangEditor: Story = {
  name: "Single-line rdf:langString value with a language selector",
  args: argsByTestFile("10.1.16 shui-text-field-with-lang-editor.ttl", import.meta.url),
};
