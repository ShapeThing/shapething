import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.viewModeLabelLayout: view mode only (edit mode always stacks the label above the
// value) - "block" (the default) stacks the label above the value, "inline" places it beside the
// value on the same line. FormElement renders the chosen layout directly as a data attribute
// (data-label-layout), so this asserts that rather than pixel geometry.
export default {
  title: "Environment/viewModeLabelLayout",
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
  mode: "view",
};

export const blockLayout: Story = {
  name: '"block" (the default): label stacks above the value',
  args: { ...baseArgs, viewModeLabelLayout: "block" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const value = await canvas.findByText("Hendrik", {}, { timeout: 5000 });
    const formElement = value.closest("[data-label-layout]");
    if (!formElement) throw new Error("Could not find the property's FormElement");
    expect(formElement.getAttribute("data-label-layout")).toBe("block");
  },
};

export const inlineLayout: Story = {
  name: '"inline": label renders beside the value on the same line',
  args: { ...baseArgs, viewModeLabelLayout: "inline" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const value = await canvas.findByText("Hendrik", {}, { timeout: 5000 });
    const formElement = value.closest("[data-label-layout]");
    if (!formElement) throw new Error("Could not find the property's FormElement");
    expect(formElement.getAttribute("data-label-layout")).toBe("inline");
  },
};
