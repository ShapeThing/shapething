import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableFacetSearchForAutocomplete: AutoCompleteEditor's search icon opens a nested
// facet-mode ShaclRenderer to narrow candidates by facet, instead of only ever the plain inline
// typeahead - only takes effect when the property's value has a known, facetable value node shape
// (see resolution/label.ts's valueNodeShapes).
export default {
  title: "Environment/enableFacetSearchForAutocomplete",
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
      sh:name "Born in"@en ;
      sh:path ex:bornIn ;
      sh:class ex:Country ;
      sh:nodeKind sh:IRI ;
      sh:node ex:countryShape ;
      shui:editor shui:AutoCompleteEditor ;
    ] .
  ex:countryShape a sh:NodeShape ;
    sh:targetClass ex:Country ;
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
  ex:data a schema:Person .
  ex:netherlands a ex:Country ; rdfs:label "Netherlands" .
  ex:germany a ex:Country ; rdfs:label "Germany" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

async function clickSearchAffordance(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByText("- Select an option -"));
}

export const disabled: Story = {
  name: "Off (the default): clicking opens the ordinary inline typeahead, no facet modal",
  args: { ...baseArgs, enableFacetSearchForAutocomplete: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("- Select an option -", {}, { timeout: 5000 });
    await clickSearchAffordance(canvasElement);
    await waitFor(() => {
      if (!canvasElement.querySelector(".st-autocomplete input.st-input")) {
        throw new Error("Expected the inline typeahead input to open");
      }
    });
    expect(canvas.queryByRole("dialog")).toBeNull();
  },
};

export const enabled: Story = {
  name: "On: opens a nested facet-mode modal to narrow candidates instead of the inline typeahead",
  args: { ...baseArgs, enableFacetSearchForAutocomplete: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("- Select an option -", {}, { timeout: 5000 });
    await clickSearchAffordance(canvasElement);

    const dialog = await canvas.findByRole("dialog");
    const dialogScope = within(dialog);
    await expect(dialogScope.findByText("Netherlands")).resolves.toBeVisible();
    await expect(dialogScope.findByText("Germany")).resolves.toBeVisible();
  },
};
