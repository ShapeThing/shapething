import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex } from "@/helpers/namespaces.ts";
import { testingEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases",
  component: ShaclRenderer,
  args: testingEnvironment,
};

export const academic: Story = {
  name: "Academic (edit)",
  args: {
    ...argsByTestFile("academic.ttl", import.meta.url),
    nodeShapes: [ex("ResearcherShape"), ex("PersonShape")],
  },
};

export const academicView: Story = {
  name: "Academic (view)",
  args: {
    ...argsByTestFile("academic.ttl", import.meta.url),
    nodeShapes: [ex("ResearcherShape"), ex("PersonShape")],
    mode: "view",
    viewModeLabelLayout: "inline",
    interfaceLocales: {
      "nl-NL": null, // remove Dutch from the shipped set, so only en-GB is available
    },
    // academic.ttl's sh:name/sh:description carry @nl tags, which would otherwise resurrect
    // nl-NL in interfaceLanguages despite the interfaceLocales removal above (see
    // enableInterfaceLanguageWithShapesLabelsOnly's doc comment in environment.ts).
    enableInterfaceLanguageWithShapesLabelsOnly: false,
  },
};

export const recipesAndChefs: Story = {
  name: "Recipes & Chefs (edit)",
  args: {
    ...argsByTestFile("recipes-and-chefs.ttl", import.meta.url),
    nodeShapes: [ex("RecipeShape")],
    enableLinksToResources: false,
  },
};

export const recipesAndChefsView: Story = {
  name: "Recipes & Chefs (view)",
  args: {
    ...argsByTestFile("recipes-and-chefs.ttl", import.meta.url),
    nodeShapes: [ex("RecipeShape")],
    mode: "view",
    viewModeLabelLayout: "inline",
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

// The one requirement the whole facets plan was built around: a shapes graph with no facet-
// specific annotations at all (no st:facet declarations anywhere in this fixture) still renders a
// full, working facet sidebar - text search (sh:alternativePath), category (sh:class, options
// derived from the data), number range, and date range - purely from ordinary SHACL constraints,
// plus a type selector since this shapes graph declares two target classes (schema:Product and
// schema:Person). See src/stories/functionality/facet-*.stories.tsx for coverage of specific facet
// mode behaviors/regressions (type union, option counts, shared predicates, checkbox reactivity) -
// this one stays a realistic, single end-to-end demo.
export const productCatalogFacets: Story = {
  name: "Product catalog (facets)",
  args: {
    ...argsByTestFile("product-catalog-facets.ttl", import.meta.url),
    // This fixture's shapes don't follow argsByTestFile's "#shape" naming convention (it declares
    // two root shapes, #productShape and #personShape) - an empty nodeShapes lets facet mode
    // auto-discover both rather than filtering everything out looking for a nonexistent "#shape".
    nodeShapes: [],
    mode: "facet",
  },
};
