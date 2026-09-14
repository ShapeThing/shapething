import type { StoryObj } from "@storybook/react-vite";
import { within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.contentLanguage: which rdf:langString translation of a data *value* renders on
// mount - independent of interfaceLanguage (which drives chrome text like sh:name, see that
// setting's own story). schema:name here already has two existing translations; contentLanguage
// picks which one shows without any switcher interaction.
export default {
  title: "Environment/contentLanguage",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Nickname"@en ; sh:path schema:name ; sh:datatype rdf:langString ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person ; schema:name "Redhead"@en, "Roodharige"@nl .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

export const englishContent: Story = {
  name: 'contentLanguage: "en-GB" - the English translation shows on mount',
  args: { ...baseArgs, contentLanguage: "en-GB" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
  },
};

export const dutchContent: Story = {
  name: 'contentLanguage: "nl-NL" - the Dutch translation shows instead, with no switcher interaction',
  args: { ...baseArgs, contentLanguage: "nl-NL" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Roodharige", {}, { timeout: 5000 });
  },
};
