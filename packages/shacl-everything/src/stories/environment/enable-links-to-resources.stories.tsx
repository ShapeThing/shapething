import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableLinksToResources: shows a link icon next to a NamedNode value in
// AutoCompleteOption (used by AutoCompleteEditor/InstancesSelectEditor/EnumSelectEditor's own
// display of an already-selected reference), linking out to the term's own IRI in a new tab.
export default {
  title: "Environment/enableLinksToResources",
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
  name: "Off (the default): the selected reference shows no external-link icon",
  args: { ...baseArgs, enableLinksToResources: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Acme Corp", {}, { timeout: 5000 });
    const trigger = await findValueTrigger(canvasElement);
    expect(trigger.querySelector(".st-autocomplete-option__iri")).toBeNull();
  },
};

export const enabled: Story = {
  name: "On: shows a link icon that opens the term's own IRI in a new tab",
  args: { ...baseArgs, enableLinksToResources: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Acme Corp", {}, { timeout: 5000 });
    const trigger = await findValueTrigger(canvasElement);
    const link = trigger.querySelector<HTMLAnchorElement>(".st-autocomplete-option__iri");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", "http://example.org/Acme");
  },
};
