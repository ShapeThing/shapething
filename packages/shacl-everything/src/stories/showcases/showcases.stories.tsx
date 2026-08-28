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
    nodeShapes: [ex("ResearcherShape"), ex("PersonShape")],
  },
};

export const academicView: Story = {
  name: "Academic (view)",
  args: {
    ...argsByTestFile("academic.ttl", import.meta.url),
    nodeShapes: [ex("ResearcherShape"), ex("PersonShape")],
    mode: "view",
    viewModeLabelLayout: "inline",
    interfaceLocales: {
      "nl-NL": null, // remove Dutch from the shipped set, so only en-GB is available
    },
    // academic.ttl's sh:name/sh:description carry @nl tags, which would otherwise resurrect
    // nl-NL in interfaceLanguages despite the interfaceLocales removal above (see
    // enableInterfaceLanguageWithShapesLabelsOnly's doc comment in environment.ts).
    enableInterfaceLanguageWithShapesLabelsOnly: false,
  },
};
