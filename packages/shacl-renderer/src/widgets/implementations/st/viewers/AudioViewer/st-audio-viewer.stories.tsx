import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:AudioViewer is a ShapeThing-original viewer, not part of the SHACL UI spec. The fixture
// points at a Wikimedia Commons file, so playing it needs the network; the test does not.
export default {
  title: "Specifications/ShapeThing (living document)/Viewers/st:AudioViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stAudioViewer: Story = {
  name: "An audio file URL picked by its file extension",
  args: { ...argsByTestFile("st-audio-viewer.ttl", import.meta.url), mode: "view" },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const audio = canvasElement.querySelector("audio");
      expect(audio).toHaveAttribute(
        "src",
        "https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg",
      );
      expect(audio).toHaveAttribute("controls");
    });
  },
};
