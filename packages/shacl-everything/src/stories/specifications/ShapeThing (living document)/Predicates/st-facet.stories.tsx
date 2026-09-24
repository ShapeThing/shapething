import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:facet names the facet widget for a property in facet mode - the facet counterpart of
// shui:editor/shui:viewer. It's also the predicate every facet's own score.ttl uses for its
// shui:WidgetScore entries. The available facets are listed on the Widgets page.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:facet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

export const stFacetScored: Story = {
  name: "No st:facet - scoring picks st:CategoryFacet for sh:in",
  args: argsByTestFile("st-facet.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByLabelText("Paperback")).resolves.toBeInTheDocument();
    expect(canvas.queryByRole("searchbox")).toBeNull();
  },
};

export const stFacetOverride: Story = {
  name: "st:facet st:TextSearchFacet overrides scoring",
  args: {
    ...argsByTestFile("st-facet.ttl", import.meta.url),
    nodeShapes: [factory.namedNode(fixtureUrl("st-facet.ttl#overrideShape", import.meta.url).href)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByRole("searchbox")).resolves.toBeInTheDocument();
    expect(canvas.queryByRole("checkbox")).toBeNull();
  },
};
