import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableFacetTextSearchMerging: facet mode only. Off (the default), each plain
// xsd:string property with no st:facet of its own gets its own separate free-text search box. On,
// preprocess/shapes.ts's mergeFacetTextSearchProperties folds every such property on a facetable
// root shape into one combined "Search" box (an sh:alternativePath across all of their
// predicates) instead.
export default {
  title: "Environment/enableFacetTextSearchMerging",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property [ sh:name "Name"@en ; sh:path schema:name ; sh:datatype xsd:string ] ;
    sh:property [ sh:name "Description"@en ; sh:path schema:description ; sh:datatype xsd:string ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:widget a schema:Product ; schema:name "Widget" ; schema:description "A useful little widget" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  mode: "facet",
};

export const disabled: Story = {
  name: "Off (the default): each plain string property gets its own separate search box",
  args: { ...baseArgs, enableFacetTextSearchMerging: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByLabelText("Name", {}, { timeout: 5000 });
    await canvas.findByLabelText("Description");
    expect(canvas.queryByLabelText("Search")).toBeNull();
  },
};

export const enabled: Story = {
  name: 'On: both properties fold into one combined "Search" box instead',
  args: { ...baseArgs, enableFacetTextSearchMerging: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByLabelText("Search", {}, { timeout: 5000 });
    expect(canvas.queryByLabelText("Name")).toBeNull();
    expect(canvas.queryByLabelText("Description")).toBeNull();
  },
};
