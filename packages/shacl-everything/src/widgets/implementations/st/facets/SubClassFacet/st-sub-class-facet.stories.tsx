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
  title: "Specifications/ShapeThing (living document)/Facets/st:SubClassFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx) -
// in "live" mode (the default), it fires a fresh SubmitResult snapshot on every debounced change.
let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stSubClassFacet: Story = {
  name: "sh:rootClass hierarchy - a chips+search combobox, same shape as shui:SubClassEditor",
  args: { ...argsByTestFile("st-sub-class-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);
    const searchInput = await canvas.findByPlaceholderText("Search…");

    // The tree - Computers nested under Electronics, itself under the root Category - only renders
    // once the field is opened, same as shui:SubClassEditor's own combobox panel (unlike a flat,
    // always-expanded option list, this scales to a taxonomy of any real size).
    expect(canvas.queryByLabelText("Computers")).toBeNull();
    await userEvent.click(searchInput);

    const computers = (await canvas.findByLabelText("Computers")) as HTMLInputElement;
    const electronics = (await canvas.findByLabelText("Electronics")) as HTMLInputElement;
    expect(computers.checked).toBe(false);

    // Every node in the tree - not just the leaves - is its own selectable option, same as
    // shui:SubClassEditor's own tree.
    await userEvent.click(computers);

    // The checkbox must visually reflect its own click, not just the underlying generated shape -
    // a controlled `checked` prop that isn't kept live off the (externally, non-React-state)
    // mutated filterShape store would otherwise snap back to unchecked the instant React
    // re-renders, making the checkbox look unclickable.
    await waitFor(() => expect(computers.checked).toBe(true));
    expect(electronics.checked).toBe(false);

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const listHead = submitResult.dataGraph.getQuads(null, sh("in"))[0]?.object;
      if (!listHead) throw new Error("sh:in has not been written yet");
      expect(getRdfList(listHead, submitResult.dataGraph).map((term) => term.value)).toEqual([
        ex("Computers").value,
      ]);
    });

    // Multi-select: checking a box leaves the panel open for further picks (unlike the
    // single-select case below) - picking a second, unrelated node keeps the first one checked
    // too, both in the DOM and in the resulting sh:in list.
    const books = (await canvas.findByLabelText("Books")) as HTMLInputElement;
    await userEvent.click(books);
    await waitFor(() => expect(books.checked).toBe(true));
    expect(computers.checked).toBe(true);

    await waitFor(() => {
      const listHead = submitResult!.dataGraph.getQuads(null, sh("in"))[0]?.object;
      expect(
        getRdfList(listHead!, submitResult!.dataGraph)
          .map((term) => term.value)
          .sort(),
      ).toEqual([ex("Books").value, ex("Computers").value].sort());
    });

    // Unchecking removes just that one value, both in the DOM and in the generated shape.
    await userEvent.click(computers);
    await waitFor(() => expect(computers.checked).toBe(false));
    expect(books.checked).toBe(true);

    await waitFor(() => {
      const listHead = submitResult!.dataGraph.getQuads(null, sh("in"))[0]?.object;
      expect(getRdfList(listHead!, submitResult!.dataGraph).map((term) => term.value)).toEqual([
        ex("Books").value,
      ]);
    });

    // Removing the last value via its own chip's remove button works the same as unchecking it in
    // the tree - down to clearing sh:in entirely rather than writing an empty list.
    const removeButton = await canvas.findByRole("button", { name: /remove/i });
    await userEvent.click(removeButton);
    await waitFor(() => {
      expect(submitResult!.dataGraph.getQuads(null, sh("in"))).toHaveLength(0);
    });
  },
};

// Environment.enableFacetOptionCounts extends to SubClassFacet's own taxonomy tree, rolled up
// through rdfs:subClassOf (structure/classHierarchy.ts's rollUpClassCounts): Widget is tagged
// Electronics directly and Laptop is tagged Computers (a child of Electronics), so Electronics'
// own count includes Laptop's too - "(2)", not just its own direct match "(1)" - and the untagged
// root Category shows the full "(3)".
export const stSubClassFacetShowsRolledUpCounts: Story = {
  name: "shows a rolled-up count per node, including every descendant",
  args: {
    ...argsByTestFile("st-sub-class-facet.ttl", import.meta.url),
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const searchInput = await canvas.findByPlaceholderText("Search…");
    await userEvent.click(searchInput);

    await canvas.findByLabelText("Category (3)");
    await canvas.findByLabelText("Electronics (2)");
    await canvas.findByLabelText("Computers (1)");
    await canvas.findByLabelText("Books (1)");
  },
};

// A class-taxonomy pick narrows sibling facets by hierarchy, not just exact value (see
// structure/filterShape.ts's copyRootClass/instanceSatisfiesConstraintNode): Laptop is tagged
// ex:Computers, a subclass of ex:Electronics, not ex:Electronics itself - selecting "Electronics"
// must still count it alongside Widget (tagged ex:Electronics directly), the same way a real
// taxonomy facet implies everything more specific filed under the picked category.
export const stSubClassFacetNarrowsSiblingFacetsByHierarchy: Story = {
  name: "Selecting a class also narrows sibling facets by everything filed under it",
  args: {
    ...argsByTestFile("st-sub-class-facet-cross-narrowing.ttl", import.meta.url),
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const priceContainer = (await canvas.findByText("Price")).closest(
      ".st-form-element",
    ) as HTMLElement;
    const [minPrice] = within(priceContainer).getAllByRole("spinbutton") as HTMLInputElement[];

    // Price >= 0: all three products qualify before any category is picked.
    await userEvent.type(minPrice, "0");
    await within(priceContainer).findByText("(3)");

    const searchInput = await canvas.findByPlaceholderText("Search…");
    await userEvent.click(searchInput);
    // Own count label includes SubClassFacet's own rolled-up "(2)" (Widget direct + Laptop via
    // ex:Computers), same as stSubClassFacetShowsRolledUpCounts above.
    const electronics = (await canvas.findByLabelText("Electronics (2)")) as HTMLInputElement;
    await userEvent.click(electronics);

    // Widget (ex:Electronics) and Laptop (ex:Computers, a subclass) both still qualify - Novel
    // (ex:Books, an unrelated branch of the taxonomy) is excluded.
    await within(priceContainer).findByText("(2)");
  },
};

export const stSubClassFacetSingleSelect: Story = {
  name: "sh:maxCount 1 - single choice, radio buttons shared across the whole tree",
  args: argsByTestFile("st-sub-class-facet-single-select.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const searchInput = await canvas.findByPlaceholderText("Search…");
    await userEvent.click(searchInput);

    const electronics = (await canvas.findByLabelText("Electronics")) as HTMLInputElement;
    expect(electronics.type).toBe("radio");

    await userEvent.click(electronics);
    // Picking a value closes the panel and clears the search text, same as shui:SubClassEditor's
    // own single-valued case - the pick then shows up as this field's only chip.
    await waitFor(() => expect(canvas.queryByLabelText("Electronics")).toBeNull());
    await canvas.findByText("Electronics");

    // Reopening and picking a node elsewhere in the tree (not just a sibling of the same parent)
    // replaces the previous pick outright - every radio in the tree shares the same native `name`.
    await userEvent.click(searchInput);
    const books = (await canvas.findByLabelText("Books")) as HTMLInputElement;
    await userEvent.click(books);

    await waitFor(() => expect(canvas.queryByLabelText("Books")).toBeNull());
    await canvas.findByText("Books");
    expect(canvas.queryByText("Electronics")).toBeNull();
  },
};
