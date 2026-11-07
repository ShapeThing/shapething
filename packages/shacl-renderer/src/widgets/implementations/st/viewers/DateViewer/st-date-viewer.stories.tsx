import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:DateViewer is a ShapeThing-original viewer, not part of the SHACL UI spec. It shows xsd date
// literals as the interface language writes them, and is picked by score for any date value.
export default {
  title: "Specifications/ShapeThing (living document)/Viewers/st:DateViewer",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stDateViewer: Story = {
  name: "Dates of birth and death, picked by datatype",
  args: { ...argsByTestFile("st-date-viewer.ttl", import.meta.url), mode: "view" },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const dates = [...canvasElement.querySelectorAll("time.st-date-viewer")];
      expect(dates.map((date) => date.textContent)).toEqual(["5 May 1813", "11 November 1855"]);
    });
  },
};
