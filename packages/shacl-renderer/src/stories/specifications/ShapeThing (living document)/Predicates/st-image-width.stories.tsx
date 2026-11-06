import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:imageWidth on a shui:ImageViewer property shape: the width in pixels of the image to load when
// Environment.enableImageResizing is on. It does not change the size the image is shown at.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:imageWidth",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stImageWidthLoadsASmallerImage: Story = {
  name: "st:imageWidth loads an image of that width",
  args: {
    ...argsByTestFile("st-image-width.ttl", import.meta.url),
    mode: "view",
    enableImageResizing: true,
  } as ShaclRendererProps,
  decorators: [
    (Story) => (
      <>
        <style>{".image-viewer { width: 120px; }"}</style>
        <Story />
      </>
    ),
  ],
};
