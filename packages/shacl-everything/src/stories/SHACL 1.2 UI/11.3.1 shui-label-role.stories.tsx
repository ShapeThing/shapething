import type { StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
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

// A minimal skos:Concept, stripped down to just the two fields this demo is about: picking
// *another concept* via shui:AutoCompleteEditor (one field local, one federated against the real
// TOOI thesaurus), each showing that concept's own skos:prefLabel as its main label and its
// skos:ConceptScheme itself as a shui:ClassificationRole chip, linking out to the scheme's own
// IRI - see <#conceptLabelShape>'s single-hop skos:inScheme path in the .ttl, and query.ts's
// buildRoleLookupQuery for how the scheme's own label is then resolved as a second step.
export const labelRoleAutoComplete: Story = {
  name: "AutoCompleteEditor resolves a linked Concept's own ConceptScheme via shui:ClassificationRole",
  args: {
    ...argsByTestFile("11.3.1 shui-label-role-autocomplete.ttl", import.meta.url),
    // TOOI only labels its concepts/schemes in Dutch (see the federated field's linked example) -
    // matches Application profiles/NL SBB's own Concept story, which federates against the same
    // endpoint.
    interfaceLanguage: "nl-NL",
    contentLanguage: "nl-NL",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // <#data> already links skos:broader ex:vervoermiddel - both its own prefLabel and its
    // scheme's ClassificationRole label must resolve immediately, with no search interaction
    // needed.
    await canvas.findByText("Vervoermiddel");
    await canvas.findByText("Vervoermiddelen");
    // The federated field's own already-linked value (skos:broadMatch tooi:gemeente) - resolved
    // over the network against the real TOOI endpoint, same as the local field above.
    await canvas.findByText("gemeente", {}, { timeout: 10000 });
    await canvas.findByText("Bestuurslagen", {}, { timeout: 10000 });

    // Dropdown *search results*, not just the already-applied value, must resolve their
    // ClassificationRole chip too - both for a local (dataGraph) search and a federated
    // (shui:searchQuery, real TOOI endpoint) one.
    const localField = (
      await canvas.findByText("Breder begrip (lokaal)")
    ).closest(".st-form-element") as HTMLElement;
    await userEvent.click(localField.querySelector(".st-edit-button") as HTMLElement);
    await userEvent.type(within(localField).getByRole("combobox"), "dier");
    const localListbox = await within(localField).findByRole("listbox");
    await within(localListbox).findByText("Dieren", {}, { timeout: 10000 });

    const federatedField = (
      await canvas.findByText("Bredere overeenkomst (gefedereerd, TOOI)")
    ).closest(".st-form-element") as HTMLElement;
    await userEvent.click(federatedField.querySelector(".st-edit-button") as HTMLElement);
    await userEvent.type(within(federatedField).getByRole("combobox"), "gemeente");
    const federatedListbox = await within(federatedField).findByRole(
      "listbox",
      {},
      { timeout: 10000 },
    );
    await within(federatedListbox).findByText("Bestuurslagen", {}, { timeout: 15000 });
  },
};
