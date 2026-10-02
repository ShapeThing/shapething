import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/Value list table header",
  component: ShaclRenderer,
  args: argsByTestFile("value-list-table-header.ttl", import.meta.url),
};

// An ordinary multi-valued property (no rdf:List / sh:memberShape) whose sh:node collapses into
// one st:HorizontalPropertyGroup renders the same table mode MemberShapeList does: the column
// labels once, in a header row above the values, and no per-row labels - each row's inputs
// borrow their accessible name from the header's label instead (see PropertyUIComponentValues).
export const valueListTableHeader: Story = {
  name: "Multi-valued sh:node property with a horizontal group renders one header row",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("ex");
    await canvas.findByDisplayValue("schema");

    const items = canvasElement.querySelector<HTMLElement>(".st-property-items--table");
    expect(items).not.toBeNull();

    await waitFor(() => {
      // Once in the header, never repeated per row.
      expect(within(items!).getAllByText("Prefix")).toHaveLength(1);
      expect(within(items!).getAllByText("Namespace")).toHaveLength(1);
      // Every row's group drops its own legend too.
      expect(items!.querySelectorAll(".st-property-group__legend")).toHaveLength(0);
    });

    // Each row's input is still named, via aria-labelledby pointing at the header's label.
    expect(canvas.getAllByRole("textbox", { name: /^Prefix/ })).toHaveLength(2);
  },
};

// A table row's "-" stays visible even where it can't remove anything - once every value is gone,
// the empty row left in their place keeps its "-", disabled, instead of losing it (so all rows
// stay as wide as the header). The nested Prefix/Namespace fields' own "-" (blocked by
// sh:minCount 1) stay hidden.
export const valueListTableEmptyRowRemove: Story = {
  name: "Table-mode empty row shows a disabled remove button",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("schema");

    const rowRemoveButtons = () =>
      canvasElement.querySelectorAll<HTMLButtonElement>(
        ".st-property-items--table > .st-property-object-wrapper > .st-property-object > button",
      );

    await waitFor(() => expect(rowRemoveButtons()).toHaveLength(2));
    // Only the two row-level buttons - none for the nested, minCount-blocked fields.
    expect(canvas.getAllByRole("button", { name: "Remove value" })).toHaveLength(2);

    await userEvent.click(rowRemoveButtons()[0]!);
    await waitFor(() => expect(canvas.queryByDisplayValue("ex")).toBeNull());
    await userEvent.click(rowRemoveButtons()[0]!);
    await waitFor(() => expect(canvas.queryByDisplayValue("schema")).toBeNull());

    await waitFor(() => expect(rowRemoveButtons()).toHaveLength(1));
    expect(rowRemoveButtons()[0]).toBeDisabled();
  },
};
