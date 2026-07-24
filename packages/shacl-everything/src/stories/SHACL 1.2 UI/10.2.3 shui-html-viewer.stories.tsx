import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.3 shui:HTMLViewer",
  component: ShaclRenderer,
};

export const shuiHTMLViewer: Story = {
  name: "rdf:HTML value parsed into DOM elements",
  args: { ...argsByTestFile("10.2.3 shui-html-viewer.ttl", import.meta.url), mode: "view" },
};
