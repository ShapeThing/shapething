import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableEditInPlace: shows an edit icon on an already-selected sh:class reference
// (here, AutoCompleteOption's own closed-state display of ex:sponsor's current value) that opens
// it for editing in a modal, without navigating away from the current form.
export default {
  title: "Environment/enableEditInPlace",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
      sh:name "Sponsor"@en ;
      sh:path ex:sponsor ;
      sh:class ex:Organization ;
      sh:nodeKind sh:IRI ;
      sh:node ex:organizationShape ;
      shui:editor shui:AutoCompleteEditor ;
    ] .
  ex:organizationShape a sh:NodeShape ;
    sh:targetClass ex:Organization ;
    sh:property [
      sh:name "Name"@en ;
      sh:path rdfs:label ;
      sh:datatype xsd:string ;
      sh:minCount 1 ; sh:maxCount 1 ;
      shui:propertyRole shui:LabelRole ;
    ] .
`;
const dataGraph = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person ; ex:sponsor ex:Acme .
  ex:Acme a ex:Organization ; rdfs:label "Acme Corp" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

async function findValueTrigger(canvasElement: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => {
    const element = canvasElement.querySelector<HTMLElement>(".st-autocomplete-option");
    if (!element) throw new Error("Could not find the resolved reference's own trigger");
    return element;
  });
}

export const disabled: Story = {
  name: "Off: the already-selected Sponsor has no edit-in-place icon",
  args: { ...baseArgs, enableEditInPlace: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Acme Corp", {}, { timeout: 5000 });
    const trigger = await findValueTrigger(canvasElement);
    expect(within(trigger).queryByRole("button", { name: /edit/i })).toBeNull();
  },
};

export const enabled: Story = {
  name: "On (the default): an edit icon opens the selected reference in a modal, in place",
  args: { ...baseArgs, enableEditInPlace: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Acme Corp", {}, { timeout: 5000 });
    const trigger = await findValueTrigger(canvasElement);
    const editButton = await within(trigger).findByRole("button", { name: /edit/i });

    await userEvent.click(editButton);
    // Portaled to <body>, unlike AutoCompleteEditor's own "Create new…" modal - see
    // AutoCompleteOption's resourceEditor prop.
    const dialog = await within(document.body).findByRole("dialog");
    await expect(within(dialog).findByDisplayValue("Acme Corp")).resolves.toBeVisible();
  },
};
