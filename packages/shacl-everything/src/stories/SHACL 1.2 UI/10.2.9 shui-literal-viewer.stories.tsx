import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.2 Viewers/10.2.9 shui:LiteralViewer",
  component: ShaclRenderer,
};

export const shuiLiteralViewer: Story = {
  name: "Lexical form of a plain literal value",
  args: { ...argsByTestFile("10.2.9 shui-literal-viewer.ttl", import.meta.url), mode: "view" },
};
