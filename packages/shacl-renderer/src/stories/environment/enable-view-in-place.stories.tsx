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

// shui:IRIEditor (edit mode): its link suffix gets the same view-in-place behavior as
// LabelViewer - here for a plain IRI property with no sh:class/sh:node, whose value is still
// targeted by ex:organizationShape (see IRIEditor's resourceShapes).
const iriEditorShapesGraph = `
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
      sh:nodeKind sh:IRI ;
      shui:editor shui:IRIEditor ;
    ] .
  ex:organizationShape a sh:NodeShape ;
    sh:targetClass ex:Organization ;
    sh:property [
      sh:name "Email"@en ;
      sh:path schema:email ;
      sh:datatype xsd:string ;
    ] .
`;

const iriEditorArgs = { ...baseArgs, shapesGraph: iriEditorShapesGraph, mode: "edit" };

async function findIriEditorLink(canvasElement: HTMLElement): Promise<HTMLAnchorElement> {
  return waitFor(
    () => {
      const element = canvasElement.querySelector<HTMLAnchorElement>(
        ".st-iri-editor a.st-input-suffix",
      );
      if (!element) throw new Error("Could not find the IRIEditor's link");
      return element;
    },
    { timeout: 5000 },
  );
}

export const iriEditorDisabled: Story = {
  name: "Off: shui:IRIEditor's link is a plain external link",
  args: { ...iriEditorArgs, enableViewInPlace: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const link = await findIriEditorLink(canvasElement);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("aria-haspopup")).toBeNull();
  },
};

export const iriEditorEnabled: Story = {
  name: "On: shui:IRIEditor's link opens the shaped, local value read-only in a modal",
  args: { ...iriEditorArgs, enableViewInPlace: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await findIriEditorLink(canvasElement);
    await waitFor(() => expect(link.getAttribute("target")).toBeNull());
    expect(link).toHaveAttribute("aria-haspopup", "dialog");

    await userEvent.click(link);
    const dialog = await canvas.findByRole("dialog");
    await expect(within(dialog).findByText("info@acme.example")).resolves.toBeVisible();
  },
};

// Same as above, but the referenced resource's shape puts its properties in an sh:PropertyGroup:
// group widgets pick edit vs view children off Environment.mode, which is still "edit" here - the
// modal's view-mode tree has to override it or the grouped properties render as editors.
const iriEditorGroupedShapesGraph = `
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
      sh:nodeKind sh:IRI ;
      shui:editor shui:IRIEditor ;
    ] .
  ex:contactGroup a sh:PropertyGroup ; sh:name "Contact"@en .
  ex:organizationShape a sh:NodeShape ;
    sh:targetClass ex:Organization ;
    sh:property [
      sh:name "Email"@en ;
      sh:path schema:email ;
      sh:datatype xsd:string ;
      sh:group ex:contactGroup ;
    ] .
`;

export const iriEditorEnabledGrouped: Story = {
  name: "On: grouped properties in shui:IRIEditor's modal still render read-only",
  args: {
    ...iriEditorArgs,
    shapesGraph: iriEditorGroupedShapesGraph,
    enableViewInPlace: true,
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await findIriEditorLink(canvasElement);
    await waitFor(() => expect(link.getAttribute("aria-haspopup")).toBe("dialog"));

    await userEvent.click(link);
    const dialog = await canvas.findByRole("dialog");
    await expect(within(dialog).findByText("info@acme.example")).resolves.toBeVisible();
    expect(dialog.querySelector("input, textarea, select")).toBeNull();
  },
};
