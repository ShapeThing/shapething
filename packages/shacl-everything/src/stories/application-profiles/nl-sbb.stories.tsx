import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";
import { minimalEnvironment, defaultEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Application profiles/NL SBB",
  component: ShaclRenderer,
  args: {
    ...minimalEnvironment,
    interfaceLocales: {
      ...defaultEnvironment.interfaceLocales,
      "en-GB": undefined,
    },
    interfaceLanguage: "nl-NL",
    contentLanguage: "nl-NL",
    contentLanguages: ["nl-NL"],
  },
};

// The Semantische relaties group's federated search (against the real TOOI government thesaurus)
// lives in this separate fixture, merged into the same shapesGraph rather than edited into
// skos-ap-nl.ttl itself - see skos-ap-nl-tooi-federation.ttl for why.
const federatedFiles = ["skos-ap-nl.ttl", "skos-ap-nl-tooi-federation.ttl"];

export const concept: Story = {
  name: "Concept",
  args: {
    ...argsByTestFile(federatedFiles, import.meta.url),
    nodeShapes: [factory.namedNode("http://nlbegrip.nl/def/skosapnl#Concept")],
  },
};

export const conceptScheme: Story = {
  name: "ConceptScheme",
  args: {
    ...argsByTestFile(federatedFiles, import.meta.url),
    nodeShapes: [factory.namedNode("http://nlbegrip.nl/def/skosapnl#ConceptScheme")],
  },
};

export const collection: Story = {
  name: "Collection",
  args: {
    ...argsByTestFile("skos-ap-nl.ttl", import.meta.url),
    nodeShapes: [factory.namedNode("http://nlbegrip.nl/def/skosapnl#Collection")],
  },
};
