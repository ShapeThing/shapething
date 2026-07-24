import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.8 shui:InstancesSelectEditor",
  component: ShaclRenderer,
};

export const shuiInstancesSelectEditor: Story = {
  name: "Drop-down of all instances of a class",
  args: argsByTestFile("10.1.8 shui-instances-select-editor.ttl", import.meta.url),
};
