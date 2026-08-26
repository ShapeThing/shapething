import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 UI/11. Property Roles/11.1 Direct Role Annotation",
  component: ShaclRenderer,
};

export const directRoleAnnotation: Story = {
  name: "shui:propertyRole shui:LabelRole directly on a property shape",
  args: argsByTestFile("11.1 shui-property-role-direct.ttl", import.meta.url),
};
