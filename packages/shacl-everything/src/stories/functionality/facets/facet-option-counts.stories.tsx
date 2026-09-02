import type { StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Facets/Option counts",
  component: ShaclRenderer,
};

// 3 products (2 Electronics, 1 Books) and 1 person - prices 19.99 (Widget), 42.50 (Gadget), 12.00
// (Novel); release dates 2024-01-15 (Widget), 2025-06-01 (Gadget), 2023-09-10 (Novel).
const { shapesGraph, dataGraph } = argsByTestFile("facet-option-counts.ttl", import.meta.url);

// Environment.enableFacetOptionCounts: every option-based facet (CategoryFacet, and TypeSelector's
// own root-shape picker, which resolves to the very same widget) shows a "(n)" count next to each
// option - how many of the current target instances actually have that value.
export const categoryAndTypeSelectorShowCounts: Story = {
  name: "CategoryFacet and TypeSelector show a count next to each option",
  args: {
    shapesGraph,
    dataGraph,
    mode: "facet",
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole("radio", { name: "Product (3)" });
    await canvas.findByRole("radio", { name: "Person (1)" });
    await canvas.findByLabelText("Electronics (2)");
    await canvas.findByLabelText("Books (1)");
  },
};

// Environment.enableFacetOptionCounts also extends to range facets: once at least one bound is
// filled in, a "(n)" count shows how many current target instances have a value inside [min, max].
export const rangeFacetsShowALiveMatchCountOnceFilled: Story = {
  name: "Number/date range facets show a live match count once a bound is filled in",
  args: {
    shapesGraph,
    dataGraph,
    mode: "facet",
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const priceContainer = (await canvas.findByText("Price")).closest(
      ".st-form-element",
    ) as HTMLElement;
    const [minPrice, maxPrice] = within(priceContainer).getAllByRole(
      "spinbutton",
    ) as HTMLInputElement[];

    const dateContainer = canvas
      .getByText("Release date")
      .closest(".st-form-element") as HTMLElement;
    const [fromDate, tillDate] = within(dateContainer).getAllByDisplayValue(
      "",
    ) as HTMLInputElement[];

    // No count anywhere until a bound is entered.
    expect(within(priceContainer).queryByText(/^\(\d+\)$/)).toBeNull();
    expect(within(dateContainer).queryByText(/^\(\d+\)$/)).toBeNull();

    // Price >= 15: Widget (19.99) and Gadget (42.50) qualify, Novel (12.00) doesn't.
    await userEvent.type(minPrice, "15");
    await within(priceContainer).findByText("(2)");

    // Narrow to [15, 20]: only Widget (19.99) still qualifies.
    await userEvent.type(maxPrice, "20");
    await within(priceContainer).findByText("(1)");

    // Clear the price facet back out before testing the date facet in isolation - counts are
    // narrowed by *every other* currently-active facet constraint (see
    // countsNarrowAcrossFacets below), so leaving price=[15,20] active here would also narrow the
    // date facet's own counts down to just Widget, the one product satisfying both.
    await userEvent.clear(minPrice);
    await userEvent.clear(maxPrice);
    expect(within(priceContainer).queryByText(/^\(\d+\)$/)).toBeNull();

    // Release date >= 2024-01-01: Widget (2024-01-15) and Gadget (2025-06-01) qualify, Novel
    // (2023-09-10) doesn't.
    fireEvent.change(fromDate, { target: { value: "2024-01-01" } });
    await within(dateContainer).findByText("(2)");

    // Narrow to [2024-01-01, 2024-12-31]: only Widget (2024-01-15) still qualifies.
    fireEvent.change(tillDate, { target: { value: "2024-12-31" } });
    await within(dateContainer).findByText("(1)");
  },
};

// The counts above are *live*: selecting a value in one facet narrows the counts shown on every
// other facet (structure/filterShape.ts's instancesMatchingOtherConstraints), not a static tally
// against every target instance regardless of what's already selected. Verified in both
// directions - a facet's own constraint never narrows its own counts (multi-selecting within the
// same sh:in shouldn't shrink its own sibling options against each other).
export const countsNarrowAcrossFacets: Story = {
  name: "Selecting a value in one facet narrows the counts shown on every other facet",
  args: {
    shapesGraph,
    dataGraph,
    mode: "facet",
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const electronics = (await canvas.findByLabelText("Electronics (2)")) as HTMLInputElement;
    await canvas.findByLabelText("Books (1)");

    const priceContainer = (await canvas.findByText("Price")).closest(
      ".st-form-element",
    ) as HTMLElement;
    const [minPrice] = within(priceContainer).getAllByRole("spinbutton") as HTMLInputElement[];

    // Price >= 20 excludes Novel (12.00, Books) and Widget (19.99, Electronics) - only Gadget
    // (42.50, Electronics) is left, so Category's own counts (narrowed by this *other* active
    // facet) must update: Electronics 2 -> 1, Books 1 -> 0.
    await userEvent.type(minPrice, "20");
    await canvas.findByLabelText("Electronics (1)");
    await canvas.findByLabelText("Books (0)");

    // The reverse direction: clear the price filter, then select Electronics (excluding Novel,
    // the only Books product) and confirm the price facet's own live match count narrows too.
    await userEvent.clear(minPrice);
    await userEvent.click(electronics);
    await userEvent.type(minPrice, "0");
    await within(priceContainer).findByText("(2)"); // Widget + Gadget, Novel excluded by category
  },
};
