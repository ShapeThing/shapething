import type { StoryObj } from "@storybook/react-vite";
import { within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableFacetOptionCounts: facet mode only. Shows a live, re-narrowing count next to
// each option-based facet's own options (here, CategoryFacet) - how many current target instances
// have that value.
export default {
  title: "Environment/enableFacetOptionCounts",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property [ sh:name "Category"@en ; sh:path schema:category ; sh:class ex:Category ] .
  ex:Electronics a ex:Category ; rdfs:label "Electronics"@en .
  ex:Books a ex:Category ; rdfs:label "Books"@en .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:widget a schema:Product ; schema:name "Widget" ; schema:category ex:Electronics .
  ex:gadget a schema:Product ; schema:name "Gadget" ; schema:category ex:Electronics .
  ex:novel a schema:Product ; schema:name "Novel" ; schema:category ex:Books .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  mode: "facet",
};

export const disabled: Story = {
  name: "Off (the default): CategoryFacet options show no counts",
  args: { ...baseArgs, enableFacetOptionCounts: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByLabelText("Electronics", {}, { timeout: 5000 });
    await canvas.findByLabelText("Books");
  },
};

export const enabled: Story = {
  name: "On: each option shows how many current target instances have that value",
  args: { ...baseArgs, enableFacetOptionCounts: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByLabelText("Electronics 2", {}, { timeout: 5000 });
    await canvas.findByLabelText("Books 1");
  },
};
