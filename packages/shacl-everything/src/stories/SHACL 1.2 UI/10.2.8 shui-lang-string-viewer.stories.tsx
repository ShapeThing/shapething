import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.8 shui:LangStringViewer",
  component: ShaclRenderer,
};

export const shuiLangStringViewer: Story = {
  name: "rdf:langString value with a language indicator",
  args: { ...argsByTestFile("10.2.8 shui-lang-string-viewer.ttl", import.meta.url), mode: "view" },
};
