import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.10 shui:NumberFieldEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiNumberFieldEditor: Story = {
  name: "xsd:decimal value",
  args: argsByTestFile("10.1.10 shui-number-field-editor.ttl", import.meta.url),
};
