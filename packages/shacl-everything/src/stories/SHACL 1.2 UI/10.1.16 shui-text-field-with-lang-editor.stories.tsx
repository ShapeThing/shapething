import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironmentWithContentLanguages } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.16 shui:TextFieldWithLangEditor",
  component: ShaclRenderer,
  args: minimalEnvironmentWithContentLanguages,
};

export const shuiTextFieldWithLangEditor: Story = {
  name: "Single-line rdf:langString value with a language selector",
  args: argsByTestFile("10.1.16 shui-text-field-with-lang-editor.ttl", import.meta.url),
};

export const shuiTextFieldWithLangEditorMultipleLanguages: Story = {
  name: "Multiple existing translations (en, nl)",
  args: argsByTestFile("10.1.16.a shui-text-field-with-lang-editor.ttl", import.meta.url),
};

export const shuiTextFieldWithLangEditorMissingTranslation: Story = {
  name: "A language declared on the shape (fr) with no translation yet",
  args: argsByTestFile("10.1.16.b shui-text-field-with-lang-editor.ttl", import.meta.url),
};
