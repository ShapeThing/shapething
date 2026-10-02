import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:suggestedValues (an rdf:List, same syntax as sh:in) is a hint, not a constraint: it's only
// used when the property shape has no sh:in, and contributes nothing to widget scoring. See
// structure/constraintResolutions.ts.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:suggestedValues",
  component: ShaclRenderer,
};

const optionLabels = (listbox: HTMLElement) =>
  within(listbox)
    .getAllByRole("option")
    .filter((option) => !option.classList.contains("st-autocomplete__result--create"))
    .map((option) => option.textContent?.trim());

// shui:AutoCompleteEditor shows the suggestions before anything is typed; typing switches back to
// the ordinary sh:class search.
export const stSuggestedValuesAutoComplete: Story = {
  name: "AutoCompleteEditor offers suggestions before typing",
  args: argsByTestFile("st-suggested-values.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editButton = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(
        ".st-autocomplete .st-edit-button",
      );
      if (!element) throw new Error("Could not find the AutoCompleteEditor search button");
      return element;
    });
    await userEvent.click(editButton);

    const listbox = await canvas.findByRole("listbox");
    await waitFor(() => expect(optionLabels(listbox)).toEqual(["Netherlands", "Belgium"]));

    await userEvent.keyboard("Germ");
    await waitFor(() => expect(optionLabels(canvas.getByRole("listbox"))).toEqual(["Germany"]));
  },
};

// shui:EnumSelectEditor lists the suggestions as its drop-down options.
export const stSuggestedValuesEnumSelect: Story = {
  name: "EnumSelectEditor lists suggestions as its options",
  args: argsByTestFile("st-suggested-values.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(".st-enum-select__trigger");
      if (!element) throw new Error("Could not find the EnumSelectEditor trigger");
      return element;
    });
    await userEvent.click(trigger);

    const listbox = await canvas.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent?.trim()))
      .toEqual(["ACT", "NSW", "VIC"]);
    await userEvent.keyboard("{Escape}");
  },
};
