import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { testingEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases/Product catalog",
  component: ShaclRenderer,
  args: testingEnvironment,
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
  name: "Facets",
  args: {
    ...argsByTestFile("product-catalog-facets.ttl", import.meta.url),
    // This fixture's shapes don't follow argsByTestFile's "#shape" naming convention (it declares
    // two root shapes, #productShape and #personShape) - an empty nodeShapes lets facet mode
    // auto-discover both rather than filtering everything out looking for a nonexistent "#shape".
    nodeShapes: [],
    mode: "facet",
  },
};
