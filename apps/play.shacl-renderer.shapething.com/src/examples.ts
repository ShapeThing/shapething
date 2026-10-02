import { splitTurtle } from "./helpers/splitTurtle";

// The examples are the shacl-renderer storybook's own showcases (packages/shacl-renderer/src/
// stories/showcases), imported straight from there so they stay in sync with the storybook. Each
// one mirrors its story's args as playground settings.
import academic from "../../../packages/shacl-renderer/src/stories/showcases/academic.ttl?raw";
import allEditors from "../../../packages/shacl-renderer/src/stories/showcases/all-editors.ttl?raw";
import allFacets from "../../../packages/shacl-renderer/src/stories/showcases/all-facets.ttl?raw";
import allViewers from "../../../packages/shacl-renderer/src/stories/showcases/all-viewers.ttl?raw";
import appointments from "../../../packages/shacl-renderer/src/stories/showcases/appointments.ttl?raw";
import insuranceClaims from "../../../packages/shacl-renderer/src/stories/showcases/insurance-claims.ttl?raw";
import productCatalogFacets from "../../../packages/shacl-renderer/src/stories/showcases/product-catalog-facets.ttl?raw";
import recipesAndChefs from "../../../packages/shacl-renderer/src/stories/showcases/recipes-and-chefs.ttl?raw";
import recipesAndChefsCss from "../../../packages/shacl-renderer/src/stories/showcases/recipes-and-chefs.css?url";
import travelBlogs from "../../../packages/shacl-renderer/src/stories/showcases/travel-blogs.ttl?raw";

export type Example = {
  shapes: string;
  data: string;
  props: Record<string, unknown>;
};

const ex = (name: string) => `http://example.org/${name}`;

// The fixtures use IRIs relative to their own URL (<#data>, <#shape>, ...), which the playground's
// editors have no URL for - so each gets an explicit @base, which the settings below refer to.
const fixture = (filename: string, text: string) => {
  const base = ex(filename);
  return {
    ...splitTurtle(`@base <${base}> .\n${text}`),
    node: (iri = "#data") => new URL(iri, base).href,
    shapeNode: (iri = "#shape") => new URL(iri, base).href,
  };
};

const example = (
  { shapes, data }: { shapes: string; data: string },
  props: Record<string, unknown>
): Example => ({ shapes, data, props });

const academicFixture = fixture("academic.ttl", academic);
const allEditorsFixture = fixture("all-editors.ttl", allEditors);
const allViewersFixture = fixture("all-viewers.ttl", allViewers);
const allFacetsFixture = fixture("all-facets.ttl", allFacets);
const appointmentsFixture = fixture("appointments.ttl", appointments);
const insuranceClaimsFixture = fixture("insurance-claims.ttl", insuranceClaims);
const productCatalogFixture = fixture("product-catalog-facets.ttl", productCatalogFacets);
// The recipe shape's st:cssImport points at a stylesheet next to the fixture, which the playground
// serves from its own asset URL instead.
const recipesFixture = fixture(
  "recipes-and-chefs.ttl",
  recipesAndChefs.replace("<./recipes-and-chefs.css>", `<${new URL(recipesAndChefsCss, location.href).href}>`)
);
const travelBlogsFixture = fixture("travel-blogs.ttl", travelBlogs);

export const examples: Record<string, Record<string, Example>> = {
  "All widgets": {
    "All editors": example(allEditorsFixture, {
      mode: "edit",
      focusNode: allEditorsFixture.node(),
      nodeShape: allEditorsFixture.shapeNode(),
    }),
    "All viewers": example(allViewersFixture, {
      mode: "view",
      focusNode: allViewersFixture.node(),
      nodeShape: allViewersFixture.shapeNode(),
    }),
    "All facets": example(allFacetsFixture, {
      mode: "facet",
      focusNode: allFacetsFixture.node(),
      nodeShape: allFacetsFixture.shapeNode(),
    }),
  },
  Academic: {
    "Edit researcher": example(academicFixture, {
      mode: "edit",
      focusNode: academicFixture.node(),
      nodeShape: [ex("ResearcherShape"), ex("PersonShape")],
    }),
    "View researcher": example(academicFixture, {
      mode: "view",
      focusNode: academicFixture.node(),
      nodeShape: [ex("ResearcherShape"), ex("PersonShape")],
      viewModeLabelLayout: "inline",
    }),
  },
  "Recipes and chefs": {
    "Edit recipe": example(recipesFixture, {
      mode: "edit",
      focusNode: recipesFixture.node(),
      nodeShape: ex("RecipeShape"),
      enableLinksToResources: false,
      enableWidgetSwitching: false,
      enableLogicalBranchSwitching: false,
      enableShPathInLabelTitle: false,
      enableFacetSearchForAutocomplete: true,
      enableFacetTextSearchMerging: true,
      enableFacetOptionCounts: true,
    }),
    "View recipe": example(recipesFixture, {
      mode: "view",
      focusNode: recipesFixture.node(),
      nodeShape: ex("RecipeViewShape"),
      viewModeLabelLayout: "inline",
    }),
    "View chef profile": example(recipesFixture, {
      mode: "view",
      focusNode: ex("massimoBottura"),
      nodeShape: ex("ChefShape"),
      viewModeLabelLayout: "inline",
    }),
  },
  "Travel blogs": {
    "Edit blog post": example(travelBlogsFixture, {
      mode: "edit",
      focusNode: travelBlogsFixture.node(),
      nodeShape: ex("TravelBlogPostShape"),
    }),
    "View blog post": example(travelBlogsFixture, {
      mode: "view",
      focusNode: travelBlogsFixture.node(),
      nodeShape: ex("TravelBlogPostShape"),
      viewModeLabelLayout: "inline",
    }),
    "Search blog posts (incl. map area select)": example(travelBlogsFixture, {
      mode: "facet",
      focusNode: travelBlogsFixture.node(),
      enableFacetOptionCounts: true,
    }),
  },
  "Conditional fields": {
    "Insurance claim (sh:targetWhere)": example(insuranceClaimsFixture, {
      mode: "edit",
      focusNode: insuranceClaimsFixture.node(),
      nodeShape: ex("InsuranceClaimShape"),
    }),
    "Appointment (sh:targetWhere on a date)": example(appointmentsFixture, {
      mode: "edit",
      focusNode: appointmentsFixture.node(),
      nodeShape: ex("AppointmentShape"),
    }),
  },
  "Product catalog": {
    "Search products": example(productCatalogFixture, {
      mode: "facet",
      focusNode: productCatalogFixture.node(),
    }),
  },
};
