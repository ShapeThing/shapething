import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/SHACL UI 1.2/10. Built-in Widgets/10.1 Editors/10.1.5 shui:DateTimePickerEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiDateTimePickerEditor: Story = {
  name: "xsd:dateTime value",
  args: argsByTestFile("10.1.5 shui-date-time-picker-editor.ttl", import.meta.url),
};
