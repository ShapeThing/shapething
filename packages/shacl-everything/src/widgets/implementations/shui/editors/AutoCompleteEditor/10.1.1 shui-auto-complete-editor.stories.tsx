import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.1 shui:AutoCompleteEditor",
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
