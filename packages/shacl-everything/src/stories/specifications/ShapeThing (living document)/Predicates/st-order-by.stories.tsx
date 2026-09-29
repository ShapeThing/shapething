import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:orderBy on a property shape lists that property's values by a position read through a
// property path from each value (see structure/orderByValues.ts) - plain RDF values have no order
// of their own. In edit mode, dragging a value renumbers every value's position 1..n.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:orderBy",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, enableUndoRedo: true },
};

const args = argsByTestFile("st-order-by.ttl", import.meta.url);

// dnd-kit measures layout between keyboard steps, so each step needs a frame to settle.
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

const textboxValues = (canvasElement: HTMLElement) =>
  within(canvasElement)
    .getAllByRole("textbox")
    .map((input) => (input as HTMLInputElement).value);

export const stOrderByEdit: Story = {
  name: "Values listed, and drag-reordered, by their position",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(textboxValues(canvasElement)).toEqual(["Mix", "Rest", "Fry"]));

    // dnd-kit's KeyboardSensor: Space picks the item up, ArrowDown moves it one slot, Space drops.
    const [firstHandle] = await canvas.findAllByRole("button", { name: "Reorder item" });
    firstHandle.focus();
    await userEvent.keyboard(" ");
    await nextFrame();
    await userEvent.keyboard("{ArrowDown}");
    await nextFrame();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(textboxValues(canvasElement)).toEqual(["Rest", "Mix", "Fry"]));

    // The renumbering is one write, so one undo restores the original order.
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(textboxValues(canvasElement)).toEqual(["Mix", "Rest", "Fry"]));
  },
};

export const stOrderByView: Story = {
  name: "View mode - values listed by their position",
  args: { ...args, mode: "view" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mix = await canvas.findByText("Mix");
    const rest = await canvas.findByText("Rest");
    const fry = await canvas.findByText("Fry");
    expect(mix.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rest.compareDocumentPosition(fry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  },
};
