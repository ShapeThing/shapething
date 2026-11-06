import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/SHACL UI 1.2/10. Built-in Widgets/10.2 Viewers/10.2.5 shui:ImageViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiImageViewer: Story = {
  name: "Image URL rendered as an <img>",
  args: { ...argsByTestFile("10.2.5 shui-image-viewer.ttl", import.meta.url), mode: "view" },
  play: async ({ canvasElement }) => {
    // The image is a link to itself, opened in a new tab.
    const image = await within(canvasElement).findByRole("img");
    const link = image.closest("a");
    expect(link).toHaveAttribute("href", image.getAttribute("src"));
    expect(link).toHaveAttribute("target", "_blank");
  },
};
