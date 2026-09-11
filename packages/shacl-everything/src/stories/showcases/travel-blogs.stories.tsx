import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex } from "@/helpers/namespaces.ts";
import { testingEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Showcases/Travel Blogs",
  component: ShaclRenderer,
  args: testingEnvironment,
};

// A tiny "microformat" - title (rdfs:label), rich-text content (schema:articleBody, rdf:HTML),
// optional photos (schema:image) and an optional geo location (ex:location, a GeoSPARQL WKT literal
// covering both points and polygons) - see travel-blogs.ttl's own comment for the full shape.
export const travelBlogs: Story = {
  name: "Edit",
  args: {
    ...argsByTestFile("travel-blogs.ttl", import.meta.url),
    nodeShapes: [ex("TravelBlogPostShape")],
  },
  parameters: {
    maxWidth: false,
  },
};

export const travelBlogsView: Story = {
  name: "View",
  args: {
    ...argsByTestFile("travel-blogs.ttl", import.meta.url),
    nodeShapes: [ex("TravelBlogPostShape")],
    mode: "view",
    viewModeLabelLayout: "inline",
  },
  parameters: {
    maxWidth: false,
  },
};

// The new st:MapFacet widget (widgets/implementations/st/facets/MapFacet) plots every travel blog
// post's own ex:location on one map and lets you drag out a rectangle or polygon (top-right toolbar)
// to narrow the list down to posts whose location falls inside it - draw a box over Europe to see
// the Lisbon/Tuscany/Iceland posts stay while Kyoto/Cape Town/Patagonia drop out.
// enableFacetOptionCounts keeps every facet's own live match count up to date as you narrow
// (structure/filterShape.ts's instancesMatchingOtherConstraints).
export const travelBlogsFacets: Story = {
  name: "Facets (incl. map area select)",
  args: {
    // This fixture declares ex:TravelBlogPostShape directly rather than following argsByTestFile's
    // own "#shape" naming convention - an empty nodeShapes lets facet mode auto-discover it (same
    // reasoning as product-catalog-facets.ttl's own story).
    ...argsByTestFile("travel-blogs.ttl", import.meta.url),
    nodeShapes: [],
    mode: "facet",
    enableFacetOptionCounts: true,
  },
  parameters: {
    maxWidth: false,
  },
};
