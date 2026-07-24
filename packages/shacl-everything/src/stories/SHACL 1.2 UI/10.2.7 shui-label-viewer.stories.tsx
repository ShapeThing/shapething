import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.7 shui:LabelViewer",
  component: ShaclRenderer,
};

export const shuiLabelViewer: Story = {
  name: "IRI value rendered as a hyperlink by its resolved display label",
  args: { ...argsByTestFile("10.2.7 shui-label-viewer.ttl", import.meta.url), mode: "view" },
};
