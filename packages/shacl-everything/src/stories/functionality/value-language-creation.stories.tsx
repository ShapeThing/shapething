import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/Value language creation",
  component: ShaclRenderer,
};

// Same fixture as language-mode.stories.tsx: two existing translations (en, nl) on a property
// that also declares a third language (fr) via sh:languageIn, but with no value in it yet.

// A plain closure rather than storybook/test's fn() - see submit.stories.tsx for why (a raw
// RdfStore has a real internal cycle that crashes fn()'s Actions-panel serialisation).
let submitCount = 0;
const onSubmit = (_result: SubmitResult) => {
  submitCount++;
};

const args: ShaclRendererProps = {
  ...argsByTestFile("value-language-creation.ttl", import.meta.url),
  languageMode: "individual",
  enableContentLanguageCreation: true,
  onSubmit,
};

function findPerValueLanguageTriggers(canvasElement: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    canvasElement.querySelectorAll<HTMLButtonElement>(
      ".st-property-object__widget > .st-listbox__wrapper .st-listbox__trigger",
    ),
  );
}

async function openPerValueLanguageMenu(trigger: HTMLButtonElement): Promise<void> {
  await userEvent.click(trigger);
}

async function clickAddLanguageOption(canvasElement: HTMLElement): Promise<void> {
  const option = within(canvasElement).getByText("Add language…");
  await userEvent.click(option);
}

function findModal(canvasElement: HTMLElement): HTMLElement {
  const dialog = canvasElement.querySelector<HTMLElement>("dialog.st-modal[open]");
  if (!dialog) throw new Error("Could not find an open create-language modal");
  return dialog;
}

function findModalInput(canvasElement: HTMLElement): HTMLInputElement {
  const input = findModal(canvasElement).querySelector<HTMLInputElement>("input.st-input");
  if (!input) throw new Error("Could not find the modal's language tag input");
  return input;
}

// Not a real <form> (see CreateLanguageModal - it's nested inside the page's own edit <form>,
// and a real nested <form> makes browsers mishandle which one a submit resolves to), so there's
// no button[type=submit] to key off - identify it by its accessible name instead.
function findModalSubmitButton(canvasElement: HTMLElement): HTMLButtonElement {
  return within(findModal(canvasElement)).getByRole("button", { name: "Add" });
}

export const addingALanguageFromAValuesOwnPickerRetagsOnlyThatValue: Story = {
  name: "Adding a language from one value's own picker retags only that value, without submitting the edit form",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("Roodharige", {}, { timeout: 5000 });
    submitCount = 0;

    const triggers = findPerValueLanguageTriggers(canvasElement);
    const enTrigger = triggers.find((t) => t.dataset.value === "en")!;

    await openPerValueLanguageMenu(enTrigger);
    await clickAddLanguageOption(canvasElement);
    expect(findModal(canvasElement)).toBeVisible();

    await userEvent.type(findModalInput(canvasElement), "de-DE");
    await userEvent.click(findModalSubmitButton(canvasElement));

    // The modal closes, the "en" value is retagged to "de-DE" (its text unchanged), and the other
    // value is untouched - all without the click bubbling into the outer edit-mode <form> and
    // firing a real submit (this dialog's own <form> is nested inside it - see Modal/CreateLanguageModal).
    expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull();
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("Roodharige", {}, { timeout: 5000 });

    const triggersAfter = findPerValueLanguageTriggers(canvasElement);
    expect(triggersAfter.map((t) => t.dataset.value).sort()).toEqual(["de-DE", "nl"]);

    await waitFor(() => expect(submitCount).toBe(0));
  },
};
