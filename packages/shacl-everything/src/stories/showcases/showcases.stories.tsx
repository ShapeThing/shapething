import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex } from "@/helpers/namespaces.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases",
  component: ShaclRenderer,
};

export const academic: Story = {
  name: "Academic",
  args: {
    ...argsByTestFile("academic.ttl", import.meta.url),
    nodeShapes: [ex("ResearcherShape"), ex("PublicationShape")],
  },
};

export const academicView: Story = {
  name: "Academic (view)",
  args: {
    ...argsByTestFile("academic.ttl", import.meta.url),
    nodeShapes: [ex("ResearcherShape")],
    mode: "view",
    viewModeLabelLayout: "inline",
  },
};
