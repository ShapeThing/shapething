import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { rdf, sh } from "@/helpers/namespaces.ts";
import { getRdfList } from "@/helpers/rdfList.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/ShapeThing (living document)/Facets/st:TextSearchFacet",
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
// count shows how many target instances currently match. "widget" matches only Widget (its
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

    expect(canvas.queryByText(/^\d+$/)).toBeNull();

    await userEvent.type(search, "widget");
    await canvas.findByText("1");

    await userEvent.clear(search);
    await userEvent.type(search, "gadget");
    await canvas.findByText("1");
  },
};

// shui:searchQuery (spec §10.1) on the facet's property: the typed text goes to that query instead
// of becoming an sh:pattern, and its ?value results are written as an sh:in on the property.
export const stTextSearchFacetSearchQuery: Story = {
  name: "shui:searchQuery - matches become an sh:in",
  args: { ...argsByTestFile("st-text-search-facet-search-query.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const search = await within(canvasElement).findByRole("searchbox");

    await userEvent.type(search, "acme");

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const listHead = submitResult.dataGraph.getQuads(null, sh("in"))[0]?.object;
      if (!listHead) throw new Error("sh:in has not been written yet");
      expect(
        getRdfList(listHead, submitResult.dataGraph).map((term) => term.value.split("#").pop()),
      ).toEqual(["acme"]);
      expect(submitResult.dataGraph.getQuads(null, sh("pattern"))).toHaveLength(0);
    });

    // No matches at all filters everything out (an explicit empty sh:in), rather than dropping
    // the constraint and showing every instance.
    await userEvent.clear(search);
    await userEvent.type(search, "nothing matches this");
    await waitFor(() => {
      const inQuads = submitResult!.dataGraph.getQuads(null, sh("in"));
      expect(inQuads).toHaveLength(1);
      expect(inQuads[0]!.object.equals(rdf("nil"))).toBe(true);
    });

    // Clearing the box removes the constraint entirely.
    await userEvent.clear(search);
    await waitFor(() => expect(submitResult!.dataGraph.getQuads(null, sh("in"))).toHaveLength(0));
  },
};

// Environment.enableFacetOptionCounts: the badge counts instances whose value is among the
// searchQuery's matches - Acme makes two of the three products.
export const stTextSearchFacetSearchQueryMatchCount: Story = {
  name: "shui:searchQuery - shows a live match count",
  args: {
    ...argsByTestFile("st-text-search-facet-search-query.ttl", import.meta.url),
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole("searchbox");

    await userEvent.type(search, "acme");
    await canvas.findByText("2");

    await userEvent.clear(search);
    await userEvent.type(search, "globex");
    await canvas.findByText("1");

    await userEvent.clear(search);
    await userEvent.type(search, "nothing matches this");
    await canvas.findByText("0");
  },
};
