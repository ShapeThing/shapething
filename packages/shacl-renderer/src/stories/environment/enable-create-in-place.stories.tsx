import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableCreateInPlace: adds a "Create new…" option to a reference-picking widget
// (here, AutoCompleteEditor's own empty-state dropdown for an unset sh:class property), minting a
// fresh instance and opening it for editing right away, rather than only ever picking among
// existing instances.
export default {
  title: "Environment/enableCreateInPlace",
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
      sh:name "Publisher"@en ;
      sh:path ex:publisher ;
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
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

async function openTheEmptyDropdown(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByText("- Select an option -"));
  await waitFor(() => {
    if (!canvasElement.querySelector(".st-autocomplete input.st-input")) {
      throw new Error("AutoCompleteEditor's search input did not open");
    }
  });
}

export const disabled: Story = {
  name: "Off (the default): the dropdown only offers existing instances, no way to create one",
  args: { ...baseArgs, enableCreateInPlace: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("- Select an option -", {}, { timeout: 5000 });
    await openTheEmptyDropdown(canvasElement);
    expect(canvas.queryByText("Create new…")).toBeNull();
  },
};

export const enabled: Story = {
  name: 'On: a "Create new…" row mints a fresh instance and opens it for editing right away',
  args: { ...baseArgs, enableCreateInPlace: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("- Select an option -", {}, { timeout: 5000 });
    await openTheEmptyDropdown(canvasElement);
    await userEvent.click(await canvas.findByText("Create new…"));

    const dialog = await canvas.findByRole("dialog");
    await expect(within(dialog).findByText("New item")).resolves.toBeVisible();
  },
};

// Same sh:class, but nothing (no sh:node, no sh:targetClass shape) describes an ex:Organization's
// own fields - "Create new…" could only mint a bare, label-less urn:uuid, so it isn't offered.
export const enabledWithoutNodeShape: Story = {
  name: 'On, but no node shape describes the class: no "Create new…" row',
  args: {
    ...baseArgs,
    shapesGraph: `
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
      ex:shape a sh:NodeShape ;
        sh:targetClass schema:Person ;
        sh:property [
          sh:name "Publisher"@en ;
          sh:path ex:publisher ;
          sh:class ex:Organization ;
          sh:nodeKind sh:IRI ;
          shui:editor shui:AutoCompleteEditor ;
        ] .
    `,
    enableCreateInPlace: true,
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("- Select an option -", {}, { timeout: 5000 });
    await openTheEmptyDropdown(canvasElement);
    expect(canvas.queryByText("Create new…")).toBeNull();
  },
};
