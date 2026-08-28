import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.11 shui:RichTextEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiRichTextEditor: Story = {
  name: "rdf:HTML value",
  args: argsByTestFile("10.1.11 shui-rich-text-editor.ttl", import.meta.url),
};
