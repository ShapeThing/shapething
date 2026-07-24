import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.2 shui:DetailsViewer",
  component: ShaclRenderer,
};

export const shuiDetailsViewer: Story = {
  name: "Nested read-only display of a value node's properties",
  args: { ...argsByTestFile("10.2.2 shui-details-viewer.ttl", import.meta.url), mode: "view" },
};
