import type { StoryObj } from "@storybook/react-vite";
import { within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.interfaceLanguage: which language chrome text (sh:name field labels, widget names,
// branch labels, FTL UI strings) renders in on mount - entirely independent of contentLanguage
// (see environment.ts's own "Two independent language axes" note). The property shape below
// declares sh:name in both English and Dutch; the data value itself is a plain (non-langString)
// literal, so content language never enters into which text changes here.
export default {
  title: "Environment/interfaceLanguage",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Name"@en, "Naam"@nl ; sh:path schema:name ; sh:datatype xsd:string ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person ; schema:name "Hendrik" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

export const englishInterface: Story = {
  name: 'interfaceLanguage: "en-GB" - the property label renders as sh:name@en',
  args: { ...baseArgs, interfaceLanguage: "en-GB" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });
    await canvas.findByText("Name", {}, { timeout: 5000 });
  },
};

export const dutchInterface: Story = {
  name: 'interfaceLanguage: "nl-NL" - the same property label renders as sh:name@nl instead, on mount',
  args: { ...baseArgs, interfaceLanguage: "nl-NL" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The value itself is unaffected by interface language - only the chrome label changes.
    await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });
    await canvas.findByText("Naam", {}, { timeout: 5000 });
  },
};
