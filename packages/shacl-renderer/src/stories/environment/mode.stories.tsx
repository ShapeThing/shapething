import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.mode: which render tree ShaclRenderer mounts - modes/edit, modes/view or
// modes/facet/index.tsx (see render.tsx's own mode switch). "edit" renders an editable form,
// "view" the same data read-only, and "facet" has no single focusNode at all - it discovers every
// facetable root shape in shapesGraph instead (see resolution/targets.ts's facetableRootShapes)
// and renders one facet widget per property.
export default {
  title: "Environment/mode",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Name"@en ; sh:path schema:name ; sh:datatype xsd:string ] .
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

export const editMode: Story = {
  name: '"edit" (the default): renders an editable form',
  args: { ...baseArgs, mode: "edit" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });
    expect(input.tagName).toBe("INPUT");
    expect(canvas.getByRole("button", { name: "Update" })).toBeVisible();
  },
};

export const viewMode: Story = {
  name: '"view": renders the same data read-only, no inputs or submit button',
  args: { ...baseArgs, mode: "view" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Hendrik", {}, { timeout: 5000 });
    expect(canvas.queryAllByRole("textbox")).toHaveLength(0);
    expect(canvas.queryByRole("button", { name: "Update" })).toBeNull();
  },
};

export const facetMode: Story = {
  name: '"facet": no single focusNode - discovers every facetable root shape and renders one facet per property',
  args: { ...baseArgs, mode: "facet" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Same schema:name property, now rendered as a facet input (TextSearchFacet, the default
    // scoring winner for a plain string with no st:facet of its own) rather than an editor bound
    // to the one instance's own value - facet mode has no focusNode, so it never shows "Hendrik".
    const facetInput = await canvas.findByLabelText("Name", {}, { timeout: 5000 });
    expect(facetInput).toBeVisible();
    expect(canvas.queryByDisplayValue("Hendrik")).toBeNull();
  },
};
