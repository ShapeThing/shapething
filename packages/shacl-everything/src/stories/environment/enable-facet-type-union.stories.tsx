import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableFacetTypeUnion: facet mode only, and only relevant with more than one
// facetable root shape. Off (the default) shows an explicit TypeSelector and only that type's own
// facets. On drops TypeSelector entirely and renders every discovered root shape's facets
// together - each facet becomes its own implicit type selector instead.
export default {
  title: "Environment/enableFacetTypeUnion",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:productShape a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property [ sh:name "Product name"@en ; sh:path schema:name ; sh:datatype xsd:string ] .
  ex:personShape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Given name"@en ; sh:path schema:givenName ; sh:datatype xsd:string ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:widget a schema:Product ; schema:name "Widget" .
  ex:alice a schema:Person ; schema:givenName "Alice" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  mode: "facet",
};

export const disabled: Story = {
  name: "Off (the default): an explicit TypeSelector picks one type, showing only its own facets",
  args: { ...baseArgs, enableFacetTypeUnion: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("radio", { name: "Product" }, { timeout: 5000 });
    await canvas.findByRole("radio", { name: "Person" });
    // Product is picked by default (the first discovered root shape) - its own facet shows, but
    // Person's does not, until the user switches types.
    await canvas.findByLabelText("Product name");
    expect(canvas.queryByLabelText("Given name")).toBeNull();
  },
};

export const enabled: Story = {
  name: "On: no type picker at all - every discovered type's facets render together",
  args: { ...baseArgs, enableFacetTypeUnion: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByLabelText("Product name", {}, { timeout: 5000 });
    await canvas.findByLabelText("Given name");
    expect(canvas.queryAllByRole("radio")).toEqual([]);
  },
};
