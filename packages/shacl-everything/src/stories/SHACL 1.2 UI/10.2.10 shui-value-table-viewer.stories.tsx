import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.10 shui:ValueTableViewer",
  component: ShaclRenderer,
};

export const shuiValueTableViewer: Story = {
  name: "Multi-viewer rendering all values as an HTML table",
  args: { ...argsByTestFile("10.2.10 shui-value-table-viewer.ttl", import.meta.url), mode: "view" },
};
