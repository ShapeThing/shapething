import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.4 shui:HyperlinkViewer",
  component: ShaclRenderer,
};

export const shuiHyperlinkViewer: Story = {
  name: "xsd:anyURI value as a clickable link",
  args: { ...argsByTestFile("10.2.4 shui-hyperlink-viewer.ttl", import.meta.url), mode: "view" },
};
