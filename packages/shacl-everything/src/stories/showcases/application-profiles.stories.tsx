import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Application profiles",
  component: ShaclRenderer,
};

export const nlSbb: Story = {
  name: "NL SBB",
  args: {
    ...argsByTestFile("skos-ap-nl.ttl", import.meta.url),
    nodeShapes: [factory.namedNode("http://nlbegrip.nl/def/skosapnl#Concept")],
  },
};

export const dcatApNl: Story = {
  name: "DCAT AP NL",
  args: {
    ...argsByTestFile("dcat-ap-nl-SHACL.ttl", import.meta.url),
    nodeShapes: [
      factory.namedNode("http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/DatasetShape"),
    ],
  },
};
