import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "ShapeThing/Facets/st:TextSearchFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx).
let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stTextSearchFacet: Story = {
  name: "sh:alternativePath across schema:name and schema:description",
  args: { ...argsByTestFile("st-text-search-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const search = await within(canvasElement).findByRole("searchbox");

    await userEvent.type(search, "gadget");

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const patterns = submitResult.dataGraph
        .getQuads(null, sh("pattern"))
        .map((quad) => quad.object.value);
      const flags = submitResult.dataGraph
        .getQuads(null, sh("flags"))
        .map((quad) => quad.object.value);
      expect(patterns).toEqual(["gadget"]);
      expect(flags).toEqual(["i"]);
    });
  },
};

// Environment.enableFacetOptionCounts extends to TextSearchFacet too: once something is typed, a
// "(n)" count shows how many target instances currently match. "widget" matches only Widget (its
// own name); "gadget" matches only Gadget (both its name and description contain it, but that
// still counts as one matching instance, not two).
export const stTextSearchFacetMatchCount: Story = {
  name: "shows a live match count once something is typed",
  args: {
    ...argsByTestFile("st-text-search-facet.ttl", import.meta.url),
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole("searchbox");

    expect(canvas.queryByText(/^\(\d+\)$/)).toBeNull();

    await userEvent.type(search, "widget");
    await canvas.findByText("(1)");

    await userEvent.clear(search);
    await userEvent.type(search, "gadget");
    await canvas.findByText("(1)");
  },
};
