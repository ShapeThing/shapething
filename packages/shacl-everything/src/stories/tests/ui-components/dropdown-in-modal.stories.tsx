import { useEffect, useRef, useState } from "react";
import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import SelectListbox from "@/outputs/render/components/SelectListbox/index.tsx";
import "@/theme/listbox.css";
import "@/theme/select.css";
import "@/outputs/render/components/Modal/style.css";

export default {
  title: "Tests/UI Components/Dropdown in modal",
};

const options = Array.from({ length: 8 }, (_, index) => `Option ${index + 1}`);

// Mirrors Modal's own DOM (a showModal()'d <dialog> around a scrolling .st-modal__content) without
// its environment/l10n dependencies - the clipping comes purely from that structure + its CSS.
function DropdownInModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(options[0]);
  useEffect(() => dialogRef.current?.showModal(), []);
  return (
    <dialog ref={dialogRef} className="st-modal">
      <div className="st-modal__content">
        <p>A select near the bottom of a modal, with little room left below it.</p>
        <SelectListbox
          ariaLabelledby="dropdown-in-modal-label"
          value={value}
          options={options}
          onChange={setValue}
          renderTriggerContent={(option) => option}
          renderOption={(option) => option}
        />
      </div>
    </dialog>
  );
}

export const dropdownEscapesModalClipping: StoryObj = {
  name: "A dropdown inside a modal isn't clipped by the modal's scrolling content",
  render: () => <DropdownInModal />,
  play: async ({ canvasElement }) => {
    const dialog = await waitFor(() => {
      const element = canvasElement.ownerDocument.querySelector<HTMLDialogElement>("dialog[open]");
      if (!element) throw new Error("Expected the modal to be open");
      return element;
    });
    await userEvent.click(within(dialog).getByRole("button"));
    const listbox = await within(dialog).findByRole("listbox");
    const content = dialog.querySelector(".st-modal__content")!;

    // The listbox extends past the scrolling content's own box - it would be cut off there if it
    // were still clipped by that overflow.
    expect(listbox.getBoundingClientRect().bottom).toBeGreaterThan(
      content.getBoundingClientRect().bottom,
    );

    // ...and an option lying below the dialog's own edge is really visible and hit-testable there,
    // not just laid out out of view.
    const dialogBottom = dialog.getBoundingClientRect().bottom;
    const option = within(listbox)
      .getAllByRole("option")
      .find((element) => element.getBoundingClientRect().top > dialogBottom);
    if (!option) throw new Error("Expected an option below the dialog's own edge");
    const rect = option.getBoundingClientRect();
    const hit = canvasElement.ownerDocument.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    expect(option.contains(hit)).toBe(true);

    const label = option.textContent!;
    await userEvent.click(option);
    expect(within(dialog).getByRole("button")).toHaveTextContent(label);
    dialog.close();
  },
};
