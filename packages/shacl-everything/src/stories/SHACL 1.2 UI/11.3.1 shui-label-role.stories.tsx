import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/SHACL 1.2 UI/11. Property Roles/11.3 Built-in Property Roles/11.3.1 shui:LabelRole",
  component: ShaclRenderer,
};

export const labelRole: Story = {
  name: "InstancesSelectEditor options display their skos:prefLabel via shui:LabelRole",
  args: argsByTestFile("11.3.1 shui-label-role.ttl", import.meta.url),
};
