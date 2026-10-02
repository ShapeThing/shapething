import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// A property combining sh:class with sh:node only offers the sh:class instances that also conform
// to that sh:node (see useConformingCandidates / useInstanceSearch's searchConformingInstances) -
// both ex:acme and ex:globex are ex:Organizations, but only ex:acme is Dutch.
export default {
  title: "Tests/Interaction/Picker candidates conform to sh:node",
  component: ShaclRenderer,
};

const shapesGraph = (editor: string) => `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
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
      sh:maxCount 1 ;
      sh:node ex:dutchOrganizationShape ;
      shui:editor ${editor} ;
    ] .
  ex:dutchOrganizationShape a sh:NodeShape ;
    sh:property [
      sh:path ex:country ;
      sh:hasValue ex:Netherlands ;
    ] .
`;

const dataGraph = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person .
  ex:acme a ex:Organization ; rdfs:label "Acme Corp" ; ex:country ex:Netherlands .
  ex:globex a ex:Organization ; rdfs:label "Globex Corp" ; ex:country ex:Germany .
`;

const argsFor = (editor: string) =>
  ({
    shapesGraph: shapesGraph(editor),
    dataGraph,
    nodeShapes: [factory.namedNode("http://example.org/shape")],
    focusNode: factory.namedNode("http://example.org/data"),
    enableCreateInPlace: false,
  }) as ShaclRendererProps;

export const instancesSelectEditor: Story = {
  name: "shui:InstancesSelectEditor leaves out a non-conforming instance",
  args: argsFor("shui:InstancesSelectEditor"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("- Select an option -", {}, { timeout: 5000 }));

    const listbox = await canvas.findByRole("listbox");
    await expect(within(listbox).findByRole("option", { name: "Acme Corp" })).resolves.toBeVisible();
    expect(within(listbox).queryByRole("option", { name: "Globex Corp" })).toBeNull();
  },
};

export const autoCompleteEditor: Story = {
  name: "shui:AutoCompleteEditor leaves out a non-conforming search result",
  args: argsFor("shui:AutoCompleteEditor"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("- Select an option -", {}, { timeout: 5000 }));

    const input = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLInputElement>(
        ".st-autocomplete input.st-input",
      );
      if (!element) throw new Error("Could not find the AutoCompleteEditor search input");
      return element;
    });
    await userEvent.type(input, "Corp");

    // Results are filtered before they're published, so once Acme shows up the list is final.
    // Matched text is wrapped in <mark>, so compare each option's whole textContent instead.
    const listbox = await canvas.findByRole("listbox");
    const optionTexts = await waitFor(
      () => {
        const texts = within(listbox)
          .queryAllByRole("option")
          .map((option) => option.textContent ?? "");
        if (!texts.some((text) => text.includes("Acme Corp"))) throw new Error("No Acme result yet");
        return texts;
      },
      { timeout: 5000 },
    );
    expect(optionTexts.some((text) => text.includes("Globex Corp"))).toBe(false);
  },
};
