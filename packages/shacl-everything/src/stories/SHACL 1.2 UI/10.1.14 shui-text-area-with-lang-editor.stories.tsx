import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.14 shui:TextAreaWithLangEditor",
  component: ShaclRenderer,
};

export const shuiTextAreaWithLangEditor: Story = {
  name: "Multi-line rdf:langString value with a language selector",
  args: argsByTestFile("10.1.14 shui-text-area-with-lang-editor.ttl", import.meta.url),
};

export const shuiTextAreaWithLangEditorMultipleLanguages: Story = {
  name: "Multiple existing translations (en, nl)",
  args: argsByTestFile("10.1.14.a shui-text-area-with-lang-editor.ttl", import.meta.url),
};

export const shuiTextAreaWithLangEditorMissingTranslation: Story = {
  name: "A language declared on the shape (fr) with no translation yet",
  args: argsByTestFile("10.1.14.b shui-text-area-with-lang-editor.ttl", import.meta.url),
};
