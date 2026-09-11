import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:MapFacet is a ShapeThing-original facet widget - facets have no SHACL-UI spec clause yet
// (unlike the shui: editors/viewers under "SHACL UI 1.2"), same precedent as
// st:NumberRangeFacet/st:CategoryFacet (see "Specifications/ShapeThing (living document)/Facets").
// Plots every ex:Trip's own location on one map; drag out a rectangle or polygon (top-right toolbar)
// to narrow the trips down to whichever ones fall inside it. No play() interaction test here - like
// st:MapViewer/st:GeoEditor's own stories, a WebGL map canvas isn't something worth asserting
// against in headless Chromium (see those widgets' own stories for the same precedent); this story
// is for visual/manual verification instead.
export default {
  title: "Specifications/ShapeThing (living document)/Facets/st:MapFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

export const stMapFacet: Story = {
  name: "Four trips, two in Europe - draw a rectangle to narrow them down",
  args: {
    // This fixture's shape doesn't follow argsByTestFile's "#shape" naming convention (it declares
    // ex:tripShape directly) - an empty nodeShapes lets facet mode auto-discover it (same reasoning
    // as showcases/product-catalog-facets.ttl's own story).
    ...argsByTestFile("st-map-facet.ttl", import.meta.url),
    nodeShapes: [],
  },
};
