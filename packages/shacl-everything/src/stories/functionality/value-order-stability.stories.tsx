import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/Value order stability",
  component: ShaclRenderer,
};

// RDF sets have no inherent order, and rdf-stores moves a value to the end of its internal index
// on every edit (an edit is a remove + re-add of the underlying quad, never an in-place update) -
// left unhandled, that reshuffles a multi-valued property's whole list on every keystroke (see
// PropertyUIComponentValues.reconcileOrder). A plain multi-valued xsd:string with three existing
// values, declared out of alphabetical order in the fixture, exercises both halves of the fix:
// the initial render still has to impose *some* deterministic order (alphabetical) rather than
// expose the store's raw iteration order, and edits/adds/removes after that must not disturb it
// further.
const args: ShaclRendererProps = argsByTestFile("value-order-stability.ttl", import.meta.url);

function tagInputs(canvasElement: HTMLElement): HTMLInputElement[] {
  return Array.from(canvasElement.querySelectorAll<HTMLInputElement>(".st-property-items input"));
}

function tagValues(canvasElement: HTMLElement): string[] {
  return tagInputs(canvasElement).map((input) => input.value);
}

async function findAllThreeTags(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  await canvas.findByDisplayValue("Alpha", {}, { timeout: 5000 });
  await canvas.findByDisplayValue("Bravo", {}, { timeout: 5000 });
  await canvas.findByDisplayValue("Charlie", {}, { timeout: 5000 });
}

export const initialRenderSortsValuesAlphabetically: Story = {
  name: "Values declared out of order in the data render alphabetically",
  args,
  play: async ({ canvasElement }) => {
    await findAllThreeTags(canvasElement);
    expect(tagValues(canvasElement)).toEqual(["Alpha", "Bravo", "Charlie"]);
  },
};

export const editingAValueKeepsItsPosition: Story = {
  name: "Editing a value in place keeps its position instead of moving it to the end",
  args,
  play: async ({ canvasElement }) => {
    await findAllThreeTags(canvasElement);

    const [first] = tagInputs(canvasElement);
    await userEvent.clear(first);
    await userEvent.type(first, "Zulu");
    await userEvent.tab();

    await within(canvasElement).findByDisplayValue("Zulu", {}, { timeout: 5000 });
    expect(tagValues(canvasElement)).toEqual(["Zulu", "Bravo", "Charlie"]);
  },
};

export const addingAValueAppendsAtTheEnd: Story = {
  name: "Adding a new value appends it after the existing, already-ordered ones",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await findAllThreeTags(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Add value" }));
    const emptyInput = tagInputs(canvasElement).at(-1)!;
    await userEvent.type(emptyInput, "Delta");
    await userEvent.tab();

    await canvas.findByDisplayValue("Delta", {}, { timeout: 5000 });
    expect(tagValues(canvasElement)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
  },
};

export const addingAValueFocusesTheNewInput: Story = {
  name: "Clicking Add value moves focus straight into the newly-added input",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await findAllThreeTags(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Add value" }));
    const emptyInput = tagInputs(canvasElement).at(-1)!;

    expect(document.activeElement).toBe(emptyInput);
  },
};

export const removingAValueKeepsTheRestInOrder: Story = {
  name: "Removing a value leaves the remaining ones in their original order",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await findAllThreeTags(canvasElement);

    // "Bravo" is the middle row - removing it exercises that the two surviving rows don't shift
    // relative to each other, not just that a removal from either end works.
    const bravoIndex = tagValues(canvasElement).indexOf("Bravo");
    const removeButtons = canvas.getAllByRole("button", { name: "Remove value" });
    await userEvent.click(removeButtons[bravoIndex]);

    await expect(canvas.queryByDisplayValue("Bravo")).not.toBeInTheDocument();
    expect(tagValues(canvasElement)).toEqual(["Alpha", "Charlie"]);
  },
};
