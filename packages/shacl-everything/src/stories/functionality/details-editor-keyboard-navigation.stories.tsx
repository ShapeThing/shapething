import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/DetailsEditor keyboard navigation",
  component: ShaclRenderer,
};

// An sh:or between a free-text string and a nested sh:node (rendered via shui:DetailsEditor) -
// this is what actually exercises DetailsEditor's own fly-out (the branch switcher), unlike a
// plain sh:node property, which has nothing to switch and so never renders one.

// Finds a property's <input> by its visible field label rather than by role/label association -
// FormElement's own <label> isn't wired up with htmlFor, so accessible-name queries can't see it.
function findFieldInput(canvasElement: HTMLElement, name: string): HTMLInputElement {
  const fieldLabel = Array.from(canvasElement.querySelectorAll(".st-form-element__label")).find(
    (element) => element.textContent?.trim() === name,
  );
  const input = fieldLabel?.closest(".st-form-element")?.querySelector("input");
  if (!input) throw new Error(`Could not find an input for the "${name}" field`);
  return input as HTMLInputElement;
}

export const keyboardNavigation: Story = {
  name: "Tab reaches the branch switcher and the nested fields, in either direction",
  args: {
    ...argsByTestFile("details-editor-keyboard-navigation.ttl", import.meta.url),
    enableLogicalBranchSwitching: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const label = await canvas.findByRole("button", { name: "Address" }, { timeout: 5000 });
    await userEvent.click(label);
    await expect(label).toHaveFocus();

    // Tab from the label goes straight into DetailsEditor's nested sub-form - its fly-out (the
    // branch/widget switcher) has no special placement of its own and simply trails after the
    // whole widget in the DOM, same as every other widget's fly-out.
    await userEvent.tab();
    const streetInput = findFieldInput(canvasElement, "Street");
    await expect(streetInput).toHaveFocus();

    // ...and Shift+Tab from there goes straight back to the label - it's the widget's only other
    // focusable ancestor, nothing else sits between them.
    await userEvent.tab({ shift: true });
    await expect(label).toHaveFocus();

    // The sh:or branch switcher (DetailsEditor's own fly-out) is still reachable by Tab, just
    // further along now, after the sub-form's own fields rather than immediately after the label.
    // It's a custom listbox rather than a native <select> (see LogicalConstraintSwitcher/
    // SelectListbox), showing the currently active branch's name as its own accessible name.
    function isBranchSwitcher(element: Element | null): boolean {
      return (
        element?.matches(".st-listbox__trigger") === true &&
        element.textContent?.trim() === "As structured fields"
      );
    }
    let reachedBranchSwitcher = false;
    for (let tabs = 0; tabs < 10 && !reachedBranchSwitcher; tabs++) {
      await userEvent.tab();
      reachedBranchSwitcher = isBranchSwitcher(document.activeElement);
    }
    expect(reachedBranchSwitcher).toBe(true);

    // Clicking straight into a nested field must keep focus there - regression: the sub-form used
    // to be marked inert the instant it gained focus, which immediately blurred whatever had just
    // been clicked inside it.
    const postalCodeInput = findFieldInput(canvasElement, "Postal code");
    await userEvent.click(postalCodeInput);
    await expect(postalCodeInput).toHaveFocus();
    await userEvent.type(postalCodeInput, "1");
    await expect(postalCodeInput).toHaveFocus();
    await expect(postalCodeInput).toHaveValue("1012 AB1");
  },
};
