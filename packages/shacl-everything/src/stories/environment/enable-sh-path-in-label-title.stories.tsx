import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableShPathInLabelTitle: wraps the property's label in a Tooltip showing its own
// sh:path, rendered as a SPARQL property path - useful for debugging/inspecting the underlying
// data model. Off by default in a from-scratch Environment, but defaultEnvironment turns it on.
export default {
  title: "Environment/enableShPathInLabelTitle",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Team name"@en ; sh:path ex:teamName ; sh:datatype xsd:string ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person ; ex:teamName "Acme" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

export const disabled: Story = {
  name: "Off: hovering the label shows no sh:path tooltip",
  args: { ...baseArgs, enableShPathInLabelTitle: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Acme", {}, { timeout: 5000 });
    // Scoped to the property's own label text, not the interface language switcher's (it has its
    // own, unrelated .st-form-element__label-text above the property).
    await userEvent.hover(await canvas.findByText("Team name"));
    expect(canvasElement.querySelectorAll(".tooltip")).toHaveLength(0);
  },
};

export const enabled: Story = {
  name: "On (defaultEnvironment's own setting): hovering the label shows its sh:path as a SPARQL property path",
  args: { ...baseArgs, enableShPathInLabelTitle: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Acme", {}, { timeout: 5000 });
    await userEvent.hover(await canvas.findByText("Team name"));
    await expect(canvas.findByText(/teamName/)).resolves.toBeVisible();
  },
};
