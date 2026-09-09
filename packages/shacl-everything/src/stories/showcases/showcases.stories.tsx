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

// Depending on the sort of claim, extra fields from separate shapes attach to the one main shape -
// ex:AutoClaimShape/HomeClaimShape/HealthClaimShape each declare only a sh:targetWhere (3.1.3.6),
// no sh:and/sh:node/sh:or link to ex:InsuranceClaimShape at all. useTargetWhereFragments (see
// outputs/render/hooks/) checks the focusNode against every sh:targetWhere shape in the
// shapesGraph and folds whichever ones conform into nodeShapes, live - changing "Claim type" in
// the open form swaps the extra fields immediately, the same as sh:or/sh:xone's ChoiceElement
// does for a branch switch (compare "7.7.3.f sh-or.ttl"). The fixture opens on an Auto claim, so
// ex:AutoClaimShape is what's attached at first - try changing Claim type to see another attach.
export const insuranceClaim: Story = {
  name: "Insurance claim (targetWhere fragments)",
  args: {
    ...argsByTestFile("insurance-claims.ttl", import.meta.url),
    nodeShapes: [ex("InsuranceClaimShape")],
  },
};

// sh:targetWhere can react to anything a SHACL shape can express - not just an equality check on
// a dedicated "kind" field like the insurance claim above. ex:UpcomingAppointmentShape/
// PastAppointmentShape react to a plain sh:minExclusive/sh:maxInclusive range on ex:scheduledDate,
// against a fixed reference date standing in for "today" (see appointments.ttl's own comment for
// why that date is spelled out in sh:description rather than anywhere else). The fixture's
// appointment is scheduled after that date, so ex:UpcomingAppointmentShape attaches - edit
// "Scheduled date" to 2026-09-09 or earlier to watch it swap for ex:PastAppointmentShape's field,
// live, the same way changing "Claim type" does above.
export const appointmentDateTrigger: Story = {
  name: "Appointment (targetWhere reacting to a date)",
  args: {
    ...argsByTestFile("appointments.ttl", import.meta.url),
    nodeShapes: [ex("AppointmentShape")],
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
