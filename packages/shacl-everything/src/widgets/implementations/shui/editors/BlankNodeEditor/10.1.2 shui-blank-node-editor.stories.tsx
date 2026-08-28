import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.2 shui:BlankNodeEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiBlankNodeEditor: Story = {
  name: "Read-only display of a blank node value",
  args: argsByTestFile("10.1.2 shui-blank-node-editor.ttl", import.meta.url),
};
