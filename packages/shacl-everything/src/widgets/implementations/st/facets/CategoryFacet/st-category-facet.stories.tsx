import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { ex, sh } from "@/helpers/namespaces.ts";
import { getRdfList } from "@/helpers/rdfList.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "ShapeThing/Facets/st:CategoryFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx) -
// in "live" mode (the default), it fires a fresh SubmitResult snapshot on every debounced change.
let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stCategoryFacet: Story = {
  name: "sh:class property with no sh:in - options come from the data itself",
  args: { ...argsByTestFile("st-category-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    // Every distinct schema:category value found across the three products (not a fixed sh:in
    // enumeration - this shape declares none) is offered, labeled via each category's own
    // rdfs:label.
    const electronics = (await canvas.findByLabelText("Electronics")) as HTMLInputElement;
    const books = (await canvas.findByLabelText("Books")) as HTMLInputElement;
    expect(electronics).toBeInTheDocument();
    expect(books).toBeInTheDocument();
    expect(electronics.checked).toBe(false);

    await userEvent.click(electronics);

    // The checkbox must visually reflect its own click, not just the underlying generated shape -
    // a controlled `checked` prop that isn't kept live off the (externally, non-React-state)
    // mutated filterShape store would otherwise snap back to unchecked the instant React
    // re-renders, making the checkbox look unclickable.
    await waitFor(() => expect(electronics.checked).toBe(true));
    expect(books.checked).toBe(false);

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const listHead = submitResult.dataGraph.getQuads(null, sh("in"))[0]?.object;
      if (!listHead) throw new Error("sh:in has not been written yet");
      expect(getRdfList(listHead, submitResult.dataGraph).map((term) => term.value)).toEqual([
        ex("Electronics").value,
      ]);
    });

    // Multi-select: checking a second option keeps the first one checked too, both in the DOM and
    // in the resulting sh:in list.
    await userEvent.click(books);
    await waitFor(() => expect(books.checked).toBe(true));
    expect(electronics.checked).toBe(true);

    await waitFor(() => {
      const listHead = submitResult!.dataGraph.getQuads(null, sh("in"))[0]?.object;
      expect(
        getRdfList(listHead!, submitResult!.dataGraph)
          .map((term) => term.value)
          .sort(),
      ).toEqual([ex("Books").value, ex("Electronics").value].sort());
    });

    // Unchecking removes just that one value, both in the DOM and in the generated shape.
    await userEvent.click(electronics);
    await waitFor(() => expect(electronics.checked).toBe(false));
    expect(books.checked).toBe(true);

    await waitFor(() => {
      const listHead = submitResult!.dataGraph.getQuads(null, sh("in"))[0]?.object;
      expect(getRdfList(listHead!, submitResult!.dataGraph).map((term) => term.value)).toEqual([
        ex("Books").value,
      ]);
    });
  },
};

export const stCategoryFacetFederated: Story = {
  name: "sh:in [ sh:select ] - options and labels come from a federated query",
  args: {
    ...argsByTestFile("st-category-facet-federated.ttl", import.meta.url),
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Options and labels come from the sh:select query's own results (LabelRole-resolved via
    // <#categoryShape>'s sh:node) - not shape.get(sh("in")) (which only ever resolves a plain
    // rdf:List) and not the data-derived `values` fallback.
    await canvas.findByLabelText("Electronics (2)");
    await canvas.findByLabelText("Books (1)");
    // Toys has no matching local product - still offered (the federated query enumerates every
    // ex:Category regardless of local usage), with a genuine zero count rather than being
    // silently dropped: valueCounts is still computed locally, keyed by termKey, so a federated
    // option with nothing in the local data simply falls back to CategoryFacet's own `?? 0`.
    await canvas.findByLabelText("Toys (0)");
  },
};
