import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex } from "@/helpers/namespaces.ts";
import { testingEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases/Recipes and Chefs",
  component: ShaclRenderer,
  args: testingEnvironment,
};

export const recipesAndChefs: Story = {
  name: "Edit",
  args: {
    ...argsByTestFile("recipes-and-chefs.ttl", import.meta.url),
    nodeShapes: [ex("RecipeShape")],
    enableLinksToResources: false,
    enableWidgetSwitching: false,
    enableLogicalBranchSwitching: false,
    enableShPathInLabelTitle: false,
    enableFacetSearchForAutocomplete: true,
    enableFacetTextSearchMerging: true,
    enableFacetOptionCounts: true,
  },
  parameters: {
    maxWidth: false,
  },
  // ex:RecipeShape declares st:cssImport <./recipes-and-chefs.css> (see resolution/cssImports.ts) -
  // confirms the actual <link> lands in document.head, not just that cssImportsForShapes()
  // resolves the URL correctly.
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Gordon Ramsay", {}, { timeout: 5000 });
    const link = document.head.querySelector(
      'link[rel="stylesheet"][href$="recipes-and-chefs.css"]',
    );
    expect(link).not.toBeNull();
  },
};

// The Chef field's facet-search modal (enableFacetSearchForAutocomplete) merges every plain text
// property of ChefShape into one "Search" box over an sh:alternativePath
// (enableFacetTextSearchMerging). A search must keep a chef when *any* of those fields matches -
// Gordon Ramsay's name does, his nationality "British" doesn't - so the result cards have to follow
// the count badge rather than SHACL's own "every value matches" sh:pattern reading.
export const recipesAndChefsChefFacetSearch: Story = {
  name: "Chef facet search",
  args: recipesAndChefs.args,
  parameters: {
    maxWidth: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Gordon Ramsay", {}, { timeout: 5000 });
    await userEvent.click((await canvas.findAllByRole("button", { name: "Edit" }))[0]);

    const dialog = within(await canvas.findByRole("dialog"));
    await expect(dialog.findByText("Julia Child")).resolves.toBeVisible();
    // ChefShape's ex:cuisine is its shui:ClassificationRole - each Teaser card shows it as a chip,
    // labelled via the cuisine class's own rdfs:label.
    await waitFor(() => {
      const chips = [...canvasElement.ownerDocument.querySelectorAll(".st-teaser .st-value-chip")];
      expect(chips.map((chip) => chip.textContent)).toEqual(
        expect.arrayContaining(["French", "Modern European"]),
      );
    });

    await userEvent.type(await dialog.findByRole("searchbox", { name: "Search" }), "Gordon");

    await waitFor(
      () => {
        expect(dialog.queryByText("Julia Child")).toBeNull();
        expect(dialog.getByText("Gordon Ramsay")).toBeVisible();
      },
      { timeout: 5000 },
    );
  },
};

export const recipesAndChefsView: Story = {
  name: "View",
  args: {
    ...argsByTestFile("recipes-and-chefs.ttl", import.meta.url),
    nodeShapes: [ex("RecipeViewShape")],
    mode: "view",
    viewModeLabelLayout: "inline",
  },
  parameters: {
    maxWidth: false,
  },
};

// The Recipe's "Chef" property only declares sh:class ex:Chef, not sh:node - valueNodeShapes()
// (resolution/label.ts) still resolves it to ChefShape by matching sh:targetClass, so the chef
// picked in recipesAndChefsView above renders with both a name (shui:LabelRole on schema:name) and
// a photo (shui:DepictionRole on schema:image) rather than a bare IRI. This story renders a chef's
// own full profile directly, to show ChefShape isn't just a label/depiction source for Recipe.
export const chefProfile: Story = {
  name: "Chef profile (view)",
  args: {
    ...argsByTestFile("recipes-and-chefs.ttl", import.meta.url),
    nodeShapes: [ex("ChefShape")],
    focusNode: ex("massimoBottura"),
    mode: "view",
    viewModeLabelLayout: "inline",
  },
};
