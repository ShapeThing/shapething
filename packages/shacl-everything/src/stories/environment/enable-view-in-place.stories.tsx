import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableViewInPlace: view mode only. shui:LabelViewer normally just links out to an
// IRI value; when this is on AND the value both already exists in dataGraph and is targeted by a
// shape in shapesGraph, clicking it instead opens that resource read-only in a Modal.
export default {
  title: "Environment/enableViewInPlace",
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
      sh:name "Employer"@en ;
      sh:path ex:employer ;
      sh:class ex:Organization ;
      sh:nodeKind sh:IRI ;
      sh:node ex:organizationShape ;
    ] .
  ex:organizationShape a sh:NodeShape ;
    sh:targetClass ex:Organization ;
    sh:property [
      sh:name "Email"@en ;
      sh:path schema:email ;
      sh:datatype xsd:string ;
    ], [
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
  ex:data a schema:Person ; ex:employer ex:acme .
  ex:acme a ex:Organization ; rdfs:label "ACME Corp" ; schema:email "info@acme.example" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
  mode: "view",
};

export const disabled: Story = {
  name: "Off (the default): the value renders as a plain external link",
  args: { ...baseArgs, enableViewInPlace: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByRole("link", { name: /ACME Corp/i }, { timeout: 5000 });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("aria-haspopup")).toBeNull();
  },
};

export const enabled: Story = {
  name: "On: clicking the already-shaped, already-in-dataGraph value opens it read-only in a modal instead",
  args: { ...baseArgs, enableViewInPlace: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByRole("link", { name: /ACME Corp/i }, { timeout: 5000 });
    expect(link.getAttribute("target")).toBeNull();

    await userEvent.click(link);
    const dialog = await canvas.findByRole("dialog");
    await expect(within(dialog).findByText("info@acme.example")).resolves.toBeVisible();

    const closeButton = within(dialog).getByRole("button", { name: /close/i });
    await userEvent.click(closeButton);
    await waitFor(() => expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull());
  },
};
