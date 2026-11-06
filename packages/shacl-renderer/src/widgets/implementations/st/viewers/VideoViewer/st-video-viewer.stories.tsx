import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:VideoViewer is a ShapeThing-original viewer, not part of the SHACL UI spec. The fixture
// points at a Wikimedia Commons file, so playing it needs the network; the test does not.
export default {
  title: "Specifications/ShapeThing (living document)/Viewers/st:VideoViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stVideoViewer: Story = {
  name: "A video file URL picked by its file extension",
  args: { ...argsByTestFile("st-video-viewer.ttl", import.meta.url), mode: "view" },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const video = canvasElement.querySelector("video");
      expect(video).toHaveAttribute(
        "src",
        "https://upload.wikimedia.org/wikipedia/commons/2/22/Volcano_Lava_Sample.webm",
      );
      expect(video).toHaveAttribute("controls");
    });
  },
};
