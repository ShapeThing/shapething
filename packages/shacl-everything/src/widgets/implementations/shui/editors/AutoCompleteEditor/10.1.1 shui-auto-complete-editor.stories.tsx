import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/SHACL UI 1.2/10. Built-in Widgets/10.1 Editors/10.1.1 shui:AutoCompleteEditor",
  component: ShaclRenderer,
};

export const shuiAutoCompleteEditor: Story = {
  name: "Auto-complete by class instances",
  args: argsByTestFile("10.1.1 shui-auto-complete-editor.ttl", import.meta.url),
};

export const shuiAutoCompleteEditorFederatedSearch: Story = {
  name: "Federated search (shui:searchQuery)",
  args: argsByTestFile("10.1.1 shui-auto-complete-editor-federated-search.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The federated-search globe icon carries its own Tooltip, nested inside the same <label> as
    // FormElement's labelTitle (the property's SPARQL path, shown as a debug Tooltip too) - they
    // must never both show at once for the same hover (see FormElement's labelSuffix, which keeps
    // the icon's Tooltip a sibling of labelTitle's rather than nesting it inside).
    const searchIcon = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(".st-property-search-icon");
      if (!element) throw new Error("Could not find the federated search icon");
      return element;
    });

    // Scoped to the property's own <label> (not just the first .st-form-element__label-text in
    // the canvas) - ShaclRenderer's interface-language switcher above the property has its own,
    // unrelated one.
    const propertyLabel = searchIcon.closest("label");
    const labelText = propertyLabel?.querySelector<HTMLElement>(".st-form-element__label-text");
    if (!labelText) throw new Error("Could not find the property's own label text");

    await userEvent.hover(labelText);
    await expect(canvas.findByText(/favouritePhilosopher/)).resolves.toBeVisible();
    let tooltips = canvasElement.querySelectorAll(".tooltip");
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0].textContent).not.toContain("external data source");
    await userEvent.unhover(labelText);

    await userEvent.hover(searchIcon);
    await expect(
      canvas.findByText("This field searches an external data source"),
    ).resolves.toBeVisible();
    tooltips = canvasElement.querySelectorAll(".tooltip");
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0].textContent).not.toContain("favouritePhilosopher");
  },
};

export const shuiAutoCompleteEditorInvalidSearchResults: Story = {
  name: "Search results outside sh:in are filtered out (spec §10.2)",
  args: argsByTestFile(
    "10.1.1 shui-auto-complete-editor-invalid-search-results.ttl",
    import.meta.url,
  ),
};

// Environment.enableFacetSearchForAutocomplete: the search icon opens a facet-search modal (a
// nested ShaclRenderer in facet mode, scoped to ex:Country) instead of the ordinary inline
// typeahead, since ex:Country has its own facetable node shape (see valueNodeShapes). Its results
// render as Teaser cards (not AutoCompleteOption, which stays reserved for the currently selected
// value/inline dropdown), each including its own st:DescriptionRole blurb.
export const shuiAutoCompleteEditorFacetSearch: Story = {
  name: "Facet search modal (Environment.enableFacetSearchForAutocomplete)",
  args: {
    ...argsByTestFile("10.1.1 shui-auto-complete-editor-facet-search.ttl", import.meta.url),
    enableFacetSearchForAutocomplete: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // ex:Netherlands is already this Person's ex:bornIn - clicking the search icon (rather than
    // the empty-state placeholder, see the other stories above) opens the facet-search modal, not
    // the inline typeahead, since canFacetSearch is true here.
    await userEvent.click(await canvas.findByRole("button", { name: "Edit" }));

    const dialog = await canvas.findByRole("dialog");
    const dialogScope = within(dialog);
    await expect(dialogScope.findByText("Search")).resolves.toBeVisible();

    // Every ex:Country instance shows up as a selectable result before any facet is touched, each
    // as a Teaser card - including its own st:DescriptionRole blurb (ex:blurb), not just its label.
    await expect(dialogScope.findByText("Netherlands")).resolves.toBeVisible();
    await expect(dialogScope.findByText("Germany")).resolves.toBeVisible();
    await expect(dialogScope.findByText("Japan")).resolves.toBeVisible();
    await expect(
      dialogScope.findByText(/famous for its canals, tulips and windmills/),
    ).resolves.toBeVisible();

    // Narrowing the nested facet mode's own Continent facet down to Asia re-runs
    // instancesMatchingOtherConstraints against the modal's own results list.
    await userEvent.click(await dialogScope.findByLabelText("Asia"));

    await waitFor(() => {
      expect(dialogScope.queryByText("Netherlands")).toBeNull();
      expect(dialogScope.queryByText("Germany")).toBeNull();
    });
    await expect(dialogScope.findByText("Japan")).resolves.toBeVisible();
    await expect(
      dialogScope.findByText(/ancient temples with cutting-edge technology/),
    ).resolves.toBeVisible();

    // Picking the narrowed-down result applies it and closes the modal, same as picking an
    // ordinary inline search result would.
    await userEvent.click(dialogScope.getByText("Japan"));
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await expect(canvas.findByText("Japan")).resolves.toBeVisible();
  },
};
