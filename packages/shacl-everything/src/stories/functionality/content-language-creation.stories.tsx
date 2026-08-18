import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Functionality/Content language creation",
  component: ShaclRenderer,
};

// Same shape of fixture as content-language-switching.stories.tsx, but with only the two
// languages the graphs actually declare - enableContentLanguageCreation is what grows the list
// here, not sh:languageIn/sh:name declaring a third language up front.
const shapesAndData = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.
@prefix schema: <http://schema.org/>.
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix ex: <http://example.com/>.

ex:shape
    a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:name "Preferred label"@en, "Voorkeursnaam"@nl ;
        sh:path skos:prefLabel ;
        sh:datatype rdf:langString ;
        sh:languageIn ( "en" "nl" ) ;
    ] ;
    .

ex:data
    a schema:Person ;
    skos:prefLabel "Redhead"@en, "Roodharige"@nl ;
    .
`;

const args: ShaclRendererProps = {
  shapesGraph: shapesAndData,
  dataGraph: shapesAndData,
  nodeShapes: [factory.namedNode("http://example.com/shape")],
  focusNode: factory.namedNode("http://example.com/data"),
  enableContentLanguageCreation: true,
};

// A freshly created language has no existing value yet, so the widget only mounts once its
// default term resolves asynchronously (see useDefaultObject) - waitFor rather than a plain
// querySelector, so this doesn't race that resolution.
async function findFieldInput(canvasElement: HTMLElement): Promise<HTMLInputElement> {
  return waitFor(() => {
    const input = canvasElement.querySelector<HTMLInputElement>(
      ".st-property-object__widget input.st-input",
    );
    if (!input) throw new Error("Could not find the property's text input");
    return input;
  });
}

// The content language switcher is a custom listbox rather than a native <select> (its rows need
// room for a per-language delete button - see ContentLanguageSwitcher) - the trigger button carries
// the active language as a data attribute rather than a real `value`, and its options only exist
// in the DOM while open, unlike a native <select>'s always-present <option>s.
function findContentLanguageTrigger(canvasElement: HTMLElement): HTMLButtonElement {
  const button = canvasElement.querySelector<HTMLButtonElement>(
    ".st-content-language-switcher .st-content-language-switcher__trigger",
  );
  if (!button) throw new Error("Could not find the content language switcher");
  return button;
}

function activeContentLanguage(canvasElement: HTMLElement): string | undefined {
  return findContentLanguageTrigger(canvasElement).dataset.activeLanguage;
}

// Every helper below assumes the menu is already open - open it first via this before reading or
// clicking into it.
async function openContentLanguageMenu(canvasElement: HTMLElement): Promise<void> {
  await userEvent.click(findContentLanguageTrigger(canvasElement));
}

function contentLanguageOptionLabels(canvasElement: HTMLElement): (string | null)[] {
  return Array.from(
    canvasElement.querySelectorAll(".st-content-language-switcher [role='option']"),
  ).map((option) => option.textContent);
}

// The "add language" trigger is the last row of the listbox (after every real language) rather
// than a separate button - clicking it opens the modal below instead of changing the active
// content language (see ContentLanguageSwitcher's openCreateModal).
async function clickAddLanguageOption(canvasElement: HTMLElement): Promise<void> {
  const option = within(canvasElement).getByText("Add language…");
  await userEvent.click(option);
}

function findModal(canvasElement: HTMLElement): HTMLElement {
  const dialog = canvasElement.querySelector<HTMLElement>("dialog.st-modal");
  if (!dialog) throw new Error("Could not find the create-language modal");
  return dialog;
}

function findModalInput(canvasElement: HTMLElement): HTMLInputElement {
  const input = findModal(canvasElement).querySelector<HTMLInputElement>("input.st-input");
  if (!input) throw new Error("Could not find the modal's language tag input");
  return input;
}

function findModalSubmitButton(canvasElement: HTMLElement): HTMLButtonElement {
  const button = findModal(canvasElement).querySelector<HTMLButtonElement>("button[type=submit]");
  if (!button) throw new Error("Could not find the modal's submit button");
  return button;
}

function findModalCancelButton(canvasElement: HTMLElement): HTMLButtonElement {
  const button = findModal(canvasElement).querySelector<HTMLButtonElement>("button[type=button]");
  if (!button) throw new Error("Could not find the modal's cancel button");
  return button;
}

export const creatingANewContentLanguageAddsItToTheSwitcher: Story = {
  name: "Creating a new content language adds it to the switcher and makes it active",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });

    await openContentLanguageMenu(canvasElement);
    expect(contentLanguageOptionLabels(canvasElement)).toEqual([
      "English",
      "Dutch",
      "Add language…",
    ]);
    const languageBeforeCreating = activeContentLanguage(canvasElement);

    await clickAddLanguageOption(canvasElement);
    expect(findModal(canvasElement)).toBeVisible();
    // Picking the "Add language…" row opens the modal without changing the active language -
    // it's a trigger, not a real selectable value.
    expect(activeContentLanguage(canvasElement)).toBe(languageBeforeCreating);

    // A malformed tag previews nothing - there's no valid code yet to resolve a label for - and is
    // rejected without closing the modal or touching the switcher.
    await userEvent.type(findModalInput(canvasElement), "not a tag");
    expect(findModal(canvasElement)).not.toHaveTextContent("Preview:");
    await userEvent.click(findModalSubmitButton(canvasElement));
    expect(findModal(canvasElement)).toHaveTextContent(
      "That doesn't look like a valid BCP 47 language tag.",
    );
    expect(findModal(canvasElement)).toBeVisible();

    // A well-formed but already-present tag is rejected as a duplicate, case-insensitively.
    await userEvent.clear(findModalInput(canvasElement));
    await userEvent.type(findModalInput(canvasElement), "EN");
    await userEvent.click(findModalSubmitButton(canvasElement));
    expect(findModal(canvasElement)).toHaveTextContent("That language is already in the list.");

    // Typing a well-formed tag previews the label it resolves to, live, before submitting -
    // lowercase "de-de" still previews as "German", same canonicalization findModalSubmitButton
    // below relies on. Fluent wraps interpolated vars in bidi-isolation characters, so this checks
    // for the label rather than an exact "Preview: German" substring.
    await userEvent.clear(findModalInput(canvasElement));
    await userEvent.type(findModalInput(canvasElement), "de-de");
    expect(findModal(canvasElement)).toHaveTextContent("Preview");
    expect(findModal(canvasElement)).toHaveTextContent("German");

    // A brand new tag is accepted, canonicalized, closes the modal, and becomes the active
    // language - which here means an empty field, since neither graph has a "de" translation.
    await userEvent.click(findModalSubmitButton(canvasElement));

    expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull();
    expect(activeContentLanguage(canvasElement)).toBe("de-DE");
    expect(await findFieldInput(canvasElement)).toHaveValue("");

    await openContentLanguageMenu(canvasElement);
    expect(contentLanguageOptionLabels(canvasElement)).toEqual([
      "English",
      "Dutch",
      "German",
      "Add language…",
    ]);
  },
};

export const cancelingDiscardsTheDraftLanguage: Story = {
  name: "Canceling the create-language modal discards the draft without adding a language",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });

    await openContentLanguageMenu(canvasElement);
    await clickAddLanguageOption(canvasElement);
    await userEvent.type(findModalInput(canvasElement), "de-DE");
    await userEvent.click(findModalCancelButton(canvasElement));

    expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull();
    await openContentLanguageMenu(canvasElement);
    expect(contentLanguageOptionLabels(canvasElement)).toEqual([
      "English",
      "Dutch",
      "Add language…",
    ]);

    // Reopening starts from a blank draft rather than the "de-DE" left over from the canceled
    // attempt above.
    await clickAddLanguageOption(canvasElement);
    expect(findModalInput(canvasElement)).toHaveValue("");
  },
};
