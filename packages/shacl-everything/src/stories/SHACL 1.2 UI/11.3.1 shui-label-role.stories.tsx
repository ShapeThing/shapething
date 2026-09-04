import type { StoryObj } from "@storybook/react-vite";
import { within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 UI/11. Property Roles/11.3 Built-in Property Roles/11.3.1 shui:LabelRole",
  component: ShaclRenderer,
};

export const labelRole: Story = {
  name: "InstancesSelectEditor options display their skos:prefLabel via shui:LabelRole",
  args: argsByTestFile("11.3.1 shui-label-role.ttl", import.meta.url),
};

// A minimal skos:Concept, stripped down to just the field this demo is about: picking a
// skos:ConceptScheme via shui:AutoCompleteEditor, showing its rdfs:label through shui:LabelRole -
// skos:ConceptScheme is labelled via rdfs:label here (unlike skos:Concept itself, which SKOS
// labels via skos:prefLabel - see 11.3.1 shui-label-role.ttl above). Local-only for now (searching
// ConceptScheme instances already in this fixture's own dataGraph); a federated field
// (skos:topConceptOf, against a real external SPARQL endpoint) follows the same pattern already
// used by Application profiles/NL SBB's Concept story.
export const labelRoleAutoComplete: Story = {
  name: "AutoCompleteEditor resolves a linked skos:ConceptScheme's rdfs:label via shui:LabelRole",
  args: argsByTestFile("11.3.1 shui-label-role-autocomplete.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // <#data> already links skos:inScheme ex:transportScheme - the resolved rdfs:label must show
    // immediately, with no search interaction needed.
    await canvas.findByText("Means of transport");
  },
};
