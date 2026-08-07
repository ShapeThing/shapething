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

function findContentLanguageSwitcher(canvasElement: HTMLElement): HTMLSelectElement {
  const select = canvasElement.querySelector<HTMLSelectElement>(
    ".st-content-language-switcher select",
  );
  if (!select) throw new Error("Could not find the content language switcher");
  return select;
}

// The "add language" trigger sits in FormElement's own actions slot, alongside the (also
// button-shaped) help tooltip trigger - .st-button (not .st-icon-button) is what tells them apart.
function findAddLanguageButton(canvasElement: HTMLElement): HTMLButtonElement {
  const button = canvasElement.querySelector<HTMLButtonElement>(
    ".st-content-language-switcher .st-form-element__actions button.st-button",
  );
  if (!button) throw new Error("Could not find the add-content-language button");
  return button;
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

    expect(
      within(findContentLanguageSwitcher(canvasElement))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["English", "Dutch"]);

    await userEvent.click(findAddLanguageButton(canvasElement));
    expect(findModal(canvasElement)).toBeVisible();

    // A malformed tag is rejected without closing the modal or touching the switcher.
    await userEvent.type(findModalInput(canvasElement), "not a tag");
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

    // A brand new tag is accepted, canonicalized, closes the modal, and becomes the active
    // language - which here means an empty field, since neither graph has a "de" translation.
    await userEvent.clear(findModalInput(canvasElement));
    await userEvent.type(findModalInput(canvasElement), "de-de");
    await userEvent.click(findModalSubmitButton(canvasElement));

    expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull();
    const select = findContentLanguageSwitcher(canvasElement);
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["English", "Dutch", "German"]);
    expect(select).toHaveValue("de-DE");
    expect(await findFieldInput(canvasElement)).toHaveValue("");
  },
};

export const cancelingDiscardsTheDraftLanguage: Story = {
  name: "Canceling the create-language modal discards the draft without adding a language",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });

    await userEvent.click(findAddLanguageButton(canvasElement));
    await userEvent.type(findModalInput(canvasElement), "de-DE");
    await userEvent.click(findModalCancelButton(canvasElement));

    expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull();
    expect(
      within(findContentLanguageSwitcher(canvasElement))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["English", "Dutch"]);

    // Reopening starts from a blank draft rather than the "de-DE" left over from the canceled
    // attempt above.
    await userEvent.click(findAddLanguageButton(canvasElement));
    expect(findModalInput(canvasElement)).toHaveValue("");
  },
};
