import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.5 shui:ImageViewer",
  component: ShaclRenderer,
};

export const shuiImageViewer: Story = {
  name: "Image URL rendered as an <img>",
  args: { ...argsByTestFile("10.2.5 shui-image-viewer.ttl", import.meta.url), mode: "view" },
};
