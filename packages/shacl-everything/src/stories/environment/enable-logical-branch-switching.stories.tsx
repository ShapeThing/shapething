import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableLogicalBranchSwitching: a property-level sh:or/sh:xone (constraining one
// property's value, not the whole node) gets a LogicalConstraintSwitcher fly-out to manually pick
// which branch is active, shown whenever the value is focused.
export default {
  title: "Environment/enableLogicalBranchSwitching",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
      sh:name "Contact"@en ;
      sh:path ex:contact ;
      sh:or (
        [ sh:name "Contact as string"@en ; sh:datatype xsd:string ]
        [ sh:name "Contact as language string"@en ; sh:datatype rdf:langString ]
      ) ;
    ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person ; ex:contact "hendrik@example.org" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

async function findWidgetInput(canvasElement: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => {
    const element = canvasElement.querySelector<HTMLElement>(".st-property-object__widget input");
    if (!element) throw new Error("expected an active widget input to render");
    return element;
  });
}

export const disabled: Story = {
  name: "Off: focusing the value shows no branch picker, even though the property has sh:or branches",
  args: { ...baseArgs, enableLogicalBranchSwitching: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const input = await findWidgetInput(canvasElement);
    input.focus();
    await waitFor(() => expect(canvasElement.querySelector(".st-property-object__fly-out")).not.toBeNull());
    expect(canvasElement.querySelector(".st-logical-constraint-switcher")).toBeNull();
  },
};

export const enabled: Story = {
  name: "On (the default): focusing the value shows a picker for the sh:or branches",
  args: { ...baseArgs, enableLogicalBranchSwitching: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const input = await findWidgetInput(canvasElement);
    input.focus();
    await waitFor(() => expect(canvasElement.querySelector(".st-logical-constraint-switcher")).not.toBeNull());
  },
};
