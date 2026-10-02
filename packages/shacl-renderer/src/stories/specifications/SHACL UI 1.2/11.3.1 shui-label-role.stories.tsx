import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { sparqlEndpointFetch } from "@/facets/testing/sparqlEndpointShim.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/SHACL UI 1.2/11. Property Roles/11.3 Built-in Property Roles/11.3.1 shui:LabelRole",
  component: ShaclRenderer,
};

export const labelRole: Story = {
  name: "InstancesSelectEditor options display their skos:prefLabel via shui:LabelRole",
  args: argsByTestFile("11.3.1 shui-label-role.ttl", import.meta.url),
};

const TOOI_ENDPOINT = "https://standaarden.overheid.nl/tooi/sparql";

// A small, verbatim subset of the real TOOI thesaurus (CONSTRUCTed from TOOI_ENDPOINT), served by
// window.fetch patched in beforeEach below - so the federated field still goes through the full
// SERVICE round trip, but doesn't depend on a live government endpoint being up and fast (it
// timed out CI, and would make Chromatic snapshots flaky). It deliberately mixes upl concepts,
// whose schemes are named with rdfs:label, and kern ones, whose schemes use skos:prefLabel - see
// the .ttl for why that matters. Application profiles/NL SBB's Concept story still federates
// against the live endpoint.
const tooiSubset = `
  @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix upl: <https://identifier.overheid.nl/tooi/def/thes/upl/> .
  @prefix kern: <https://identifier.overheid.nl/tooi/def/thes/kern/> .

  upl:gemeente a skos:Concept ;
    skos:prefLabel "gemeente"@nl ; rdfs:label "gemeente"@nl ; skos:inScheme upl:Bestuurslagen .
  upl:c_uq6he5yc a skos:Concept ;
    skos:prefLabel "gemeentegids"@nl ; skos:altLabel "gemeentegids aanvragen"@nl ;
    rdfs:label "gemeentegids"@nl ; skos:inScheme upl:Uniformeproductnamenlijst .
  kern:c_49ea8180 a skos:Concept ;
    skos:prefLabel "gemeente"@nl ; skos:inScheme kern:overheidsorganisatie .
  kern:c_2a7d8663 a skos:Concept ;
    skos:prefLabel "gemeenteraad"@nl ; skos:inScheme kern:bestuursorgaan .

  upl:Bestuurslagen a skos:ConceptScheme ; rdfs:label "Bestuurslagen"@nl .
  upl:Uniformeproductnamenlijst a skos:ConceptScheme ; rdfs:label "Uniforme Productnamenlijst"@nl .
  kern:overheidsorganisatie a skos:ConceptScheme ; skos:prefLabel "overheidsorganisatie"@nl .
  kern:bestuursorgaan a skos:ConceptScheme ; skos:prefLabel "bestuursorgaan"@nl .
`;

let tooiFetch: ReturnType<typeof sparqlEndpointFetch> | undefined;

// A minimal skos:Concept, stripped down to just the two fields this demo is about: picking
// *another concept* via shui:AutoCompleteEditor (one field local, one federated against a TOOI
// stand-in, see tooiSubset above), each showing that concept's own skos:prefLabel as its main label and its
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
  beforeEach: async () => {
    tooiFetch = sparqlEndpointFetch(await parseRdf(tooiSubset, "text/turtle"));
    const tooi = tooiFetch;
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      return url.startsWith(TOOI_ENDPOINT) ? tooi(input, init) : originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // <#data> already links skos:broader ex:vervoermiddel - both its own prefLabel and its
    // scheme's ClassificationRole label must resolve immediately, with no search interaction
    // needed. Even this local (non-federated) lookup goes through query.ts's lazily-constructed,
    // per-module Comunica engine (see CLAUDE.md) - its cold-start cost under a full test-suite run
    // (many browser test files each paying it once) can exceed the default 1000ms findByText
    // timeout, so this is given the same generous timeout as the federated lookups below.
    await canvas.findByText("Vervoermiddel", {}, { timeout: 10000 });
    await canvas.findByText("Vervoermiddelen", {}, { timeout: 10000 });
    // The federated field's own already-linked value (skos:broadMatch tooi:gemeente) - resolved
    // through a SERVICE request to the (stubbed) TOOI endpoint.
    await canvas.findByText("gemeente", {}, { timeout: 10000 });
    await canvas.findByText("Bestuurslagen", {}, { timeout: 10000 });

    // Dropdown *search results*, not just the already-applied value, must resolve their
    // ClassificationRole chip too - both for a local (dataGraph) search and a federated
    // (shui:searchQuery, stubbed TOOI endpoint) one. The federated search must chip both a upl
    // scheme (rdfs:label) and a kern one (skos:prefLabel).
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
    await within(federatedListbox).findByText("Bestuurslagen", {}, { timeout: 10000 });
    await within(federatedListbox).findByText("overheidsorganisatie", {}, { timeout: 10000 });

    // The federated field really went through the SERVICE round trip to the stub.
    expect(tooiFetch!.requests.length).toBeGreaterThan(0);
  },
};
