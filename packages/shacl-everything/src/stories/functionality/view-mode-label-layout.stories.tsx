import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/View mode label layout",
  component: ShaclRenderer,
};

// Environment.viewModeLabelLayout is a single global setting (not read from shapes), so one plain
// property is enough to exercise both values - see FormElement's own labelLayout prop and view
// mode's PropertyUIComponent, which is the only place that reads it.
const shapesAndData = `
@prefix schema: <http://schema.org/>.
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix ex: <http://example.org/>.

ex:shape
    a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:name "Given name"@en ;
        sh:path schema:givenName ;
    ] .

ex:data
    a schema:Person ;
    schema:givenName "Hendrik" .
`;

const baseArgs: ShaclRendererProps = {
  shapesGraph: shapesAndData,
  dataGraph: shapesAndData,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
  mode: "view",
};

// Scoped to .st-node-ui-component (the actual property tree) - a bare .st-form-element also
// matches the header's InterfaceLanguageSwitcher/ContentLanguageSwitcher, which render their own
// FormElement first in DOM order and always default to "block", regardless of this setting.
function propertyFormElement(canvasElement: HTMLElement): HTMLElement {
  const element = canvasElement.querySelector<HTMLElement>(
    ".st-node-ui-component .st-form-element",
  );
  if (!element) throw new Error("Could not find the property's .st-form-element");
  return element;
}

export const blockIsTheDefault: Story = {
  name: "Unset viewModeLabelLayout stacks the label above its value, same as always",
  args: baseArgs,
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Hendrik", {}, { timeout: 5000 });
    expect(propertyFormElement(canvasElement).dataset.labelLayout).toBe("block");
  },
};

export const inlinePlacesTheLabelBesideItsValue: Story = {
  name: 'viewModeLabelLayout: "inline" places the label beside its value instead',
  args: { ...baseArgs, viewModeLabelLayout: "inline" },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Hendrik", {}, { timeout: 5000 });
    expect(propertyFormElement(canvasElement).dataset.labelLayout).toBe("inline");
  },
};
