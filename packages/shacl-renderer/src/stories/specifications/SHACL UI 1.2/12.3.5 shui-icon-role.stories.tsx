import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { parseRdf } from "@/helpers/rdf.ts";
import { sparqlEndpointFetch } from "@/facets/testing/sparqlEndpointShim.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/SHACL UI 1.2/11. Property Roles/11.3 Built-in Property Roles/12.3.5 shui:IconRole",
  component: ShaclRenderer,
};

// The spec's example 44: <#islandIcon> declares a class-wide sh:defaultValue icon, so Texel and
// Vlieland (no ex:islandIcon of their own) both show the shared island icon next to their label,
// while Krakatoa's own ex:islandIcon value overrides it - see resolution/label.ts's valueNodeIcon.
export const iconRole: Story = {
  name: "LabelViewer shows a shui:IconRole icon, falling back to its sh:defaultValue",
  args: { ...argsByTestFile("12.3.5 shui-icon-role.ttl", import.meta.url), mode: "view" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const iconOf = async (label: string) => {
      const link = await canvas.findByRole("link", { name: label });
      return link.querySelector("img.st-label-viewer__icon")?.getAttribute("src");
    };

    await expect(await iconOf("Texel")).toMatch(/shui-icon-role-island\.svg$/);
    await expect(await iconOf("Vlieland")).toMatch(/shui-icon-role-island\.svg$/);
    await expect(await iconOf("Krakatoa")).toMatch(/shui-icon-role-volcano\.svg$/);
  },
};

const ISLANDS_ENDPOINT = "https://islands.example.org/sparql";

// The remote side of the federated field, served by window.fetch patched in beforeEach below.
// Surtsey carries its own ex:islandIcon there (an absolute URL, so it also loads from the stub);
// Vlieland has none, so it falls back to the shape's local sh:defaultValue icon.
const remoteIslands = () => `
  @prefix ex: <http://example.org/> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

  ex:surtsey a ex:Island ;
    rdfs:label "Surtsey"@en ;
    ex:islandIcon <${fixtureUrl("shui-icon-role-volcano.svg", import.meta.url).href}> .
  ex:vlieland a ex:Island ; rdfs:label "Vlieland"@en .
`;

let islandsFetch: ReturnType<typeof sparqlEndpointFetch> | undefined;

const iconSrc = (container: Element | null | undefined) =>
  container?.querySelector("img.st-autocomplete-option__icon")?.getAttribute("src");

// A search result's label is split by the <mark> highlighting the typed text, so match the whole
// option's text rather than a single text node.
const findOption = (listbox: HTMLElement, label: string) =>
  waitFor(
    () => {
      const option = [...listbox.querySelectorAll(".st-autocomplete-option")].find((element) =>
        element.textContent?.includes(label),
      );
      if (!option) throw new Error(`No "${label}" option yet`);
      return option;
    },
    { timeout: 10000 },
  );

export const iconRoleEdit: Story = {
  name: "AutoCompleteEditor shows shui:IconRole icons, also for federated values",
  args: argsByTestFile("12.3.5 shui-icon-role-edit.ttl", import.meta.url),
  beforeEach: async () => {
    islandsFetch = sparqlEndpointFetch(await parseRdf(remoteIslands(), "text/turtle"));
    const islands = islandsFetch;
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      return url.startsWith(ISLANDS_ENDPOINT) ? islands(input, init) : originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = async (name: string) =>
      (await canvas.findByText(name)).closest(".st-form-element") as HTMLElement;

    // Local: the applied value's own icon, and a search result's sh:defaultValue icon.
    const localField = await field("Visited island (local)");
    await within(localField).findByText("Krakatoa", {}, { timeout: 10000 });
    await expect(iconSrc(localField)).toMatch(/shui-icon-role-volcano\.svg$/);

    await userEvent.click(localField.querySelector(".st-edit-button") as HTMLElement);
    await userEvent.type(within(localField).getByRole("combobox"), "tex");
    const localListbox = await within(localField).findByRole("listbox");
    await expect(iconSrc(await findOption(localListbox, "Texel"))).toMatch(
      /shui-icon-role-island\.svg$/,
    );

    // Federated: the applied value's icon comes from the remote endpoint, while a remote search
    // result without one still gets the local sh:defaultValue icon.
    const federatedField = await field("Dream island (federated)");
    await within(federatedField).findByText("Surtsey", {}, { timeout: 10000 });
    await expect(iconSrc(federatedField)).toMatch(/shui-icon-role-volcano\.svg$/);

    await userEvent.click(federatedField.querySelector(".st-edit-button") as HTMLElement);
    await userEvent.type(within(federatedField).getByRole("combobox"), "vlie");
    const federatedListbox = await within(federatedField).findByRole(
      "listbox",
      {},
      { timeout: 10000 },
    );
    await expect(iconSrc(await findOption(federatedListbox, "Vlieland"))).toMatch(
      /shui-icon-role-island\.svg$/,
    );

    expect(islandsFetch!.requests.length).toBeGreaterThan(0);
  },
};
