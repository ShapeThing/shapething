import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.6 shui:IRIViewer",
  component: ShaclRenderer,
};

export const shuiIRIViewer: Story = {
  name: "IRI value rendered as a hyperlink by its IRI",
  args: { ...argsByTestFile("10.2.6 shui-iri-viewer.ttl", import.meta.url), mode: "view" },
};
