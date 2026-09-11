import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
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
  // ex:ChefShape declares st:cssImport <./recipes-and-chefs.css> (see resolution/cssImports.ts) -
  // confirms the actual <link> lands in document.head, not just that cssImportsForShapes()
  // resolves the URL correctly.
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Massimo Bottura");
    const link = document.head.querySelector(
      'link[rel="stylesheet"][href$="recipes-and-chefs.css"]',
    );
    expect(link).not.toBeNull();
  },
};
