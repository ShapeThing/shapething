import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableWidgetSwitching: when a property has more than one scored widget candidate,
// focusing its value shows a WidgetSwitcher fly-out to manually override which one renders. A
// list-valued sh:datatype (SHACL 1.2) naturally offers more than one candidate - here both a
// Number Field and a Text Field score for the same value.
export default {
  title: "Environment/enableWidgetSwitching",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetNode ex:data ;
    sh:property [ sh:name "Quantity"@en ; sh:path ex:quantity ; sh:datatype ( xsd:integer xsd:string ) ] .
`;
const dataGraph = `
  @prefix ex: <http://example.org/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  ex:data ex:quantity "5"^^xsd:integer .
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
  name: "Off (the default is on - shown here for contrast): focusing the value shows no widget picker",
  args: { ...baseArgs, enableWidgetSwitching: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const input = await findWidgetInput(canvasElement);
    input.focus();
    await waitFor(() => expect(canvasElement.querySelector(".st-property-object__fly-out")).not.toBeNull());
    expect(canvasElement.querySelector(".st-widget-switcher")).toBeNull();
  },
};

export const enabled: Story = {
  name: "On: focusing the value shows a widget picker offering every scored candidate",
  args: { ...baseArgs, enableWidgetSwitching: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const input = await findWidgetInput(canvasElement);
    input.focus();
    await waitFor(() => expect(canvasElement.querySelector(".st-widget-switcher")).not.toBeNull());
  },
};
