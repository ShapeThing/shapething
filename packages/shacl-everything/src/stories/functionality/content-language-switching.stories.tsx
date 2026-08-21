import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Functionality/Content language switching",
  component: ShaclRenderer,
};

// A single-line rdf:langString property with two existing translations (en, nl) and a third
// language (fr) declared via sh:languageIn/sh:name but with no value yet - covers both "switch
// between existing translations" and "switch to a language that needs a brand new translation".
// Absolute ex:-prefixed IRIs throughout, rather than <#...> fragments, since parseRdfText (see
// preprocess/resolveRdfSources.ts) parses this inline turtle with no baseIRI to resolve against.
const shapesAndData = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.
@prefix schema: <http://schema.org/>.
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix ex: <http://example.org/>.

ex:shape
    a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:name "Preferred label"@en, "Voorkeursnaam"@nl, "Nom préféré"@fr ;
        sh:path skos:prefLabel ;
        sh:datatype rdf:langString ;
        sh:languageIn ( "en" "nl" "fr" ) ;
    ] ;
    .

ex:data
    a schema:Person ;
    schema:givenName "Hendrik" ;
    skos:prefLabel "Redhead"@en, "Roodharige"@nl ;
    .
`;

const args: ShaclRendererProps = {
  shapesGraph: shapesAndData,
  dataGraph: shapesAndData,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

// FormElement's own <label> isn't wired up with htmlFor, so accessible-name queries can't see
// it - this finds a property's <input> by its visible field label instead, same helper as
// details-editor-keyboard-navigation.stories.tsx. A language switch to one with no existing value
// leaves the widget to mount only once its default term resolves asynchronously (see
// useDefaultObject) - waitFor rather than a plain querySelector, so this doesn't race that
// resolution (same reasoning as content-language-creation.stories.tsx's own version).
async function findFieldInput(canvasElement: HTMLElement): Promise<HTMLInputElement> {
  return waitFor(() => {
    const input = canvasElement.querySelector<HTMLInputElement>(
      ".st-property-object__widget input.st-input",
    );
    if (!input) throw new Error("Could not find the property's text input");
    return input;
  });
}

// The interface/content language switchers are FormElements too, so their labels share the
// same class - skip anything inside the header to land on the property's own label.
function findFieldLabel(canvasElement: HTMLElement): HTMLElement {
  const header = canvasElement.querySelector(".st-header");
  const label = Array.from(
    canvasElement.querySelectorAll<HTMLElement>(".st-form-element__label"),
  ).find((element) => !header?.contains(element));
  if (!label) throw new Error("Could not find the property's field label");
  return label;
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

async function pickContentLanguage(canvasElement: HTMLElement, language: string): Promise<void> {
  const option = canvasElement.querySelector<HTMLElement>(
    `.st-content-language-switcher [data-language="${language}"]`,
  );
  if (!option) throw new Error(`Could not find content language option "${language}"`);
  await userEvent.click(option);
}

function findInterfaceLanguageSwitcher(canvasElement: HTMLElement): HTMLSelectElement {
  const select = canvasElement.querySelector<HTMLSelectElement>(
    ".st-interface-language-switcher select",
  );
  if (!select) throw new Error("Could not find the interface language switcher");
  return select;
}

export const switchingContentLanguageShowsTheMatchingTranslation: Story = {
  name: "Switching content language shows the matching translation, without changing the field's own label",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The label renders as soon as the shape resolves, but the actual editable widget only
    // mounts once its default/current term resolves asynchronously (see useDefaultObject) - wait
    // for the value itself so the widget is guaranteed to be there before asserting on it.
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });

    // Content language options are named in the current *interface* language (English here),
    // not each language's own autonym - that's how the interface language switcher's own
    // options are named (see contentAndInterfaceLanguagesAreIndependent below). The trailing
    // "Add language…" entry is there because enableContentLanguageCreation defaults to true (see
    // defaultEnvironment) - it's not a real language, just how creation is triggered now (see
    // content-language-creation.stories.tsx).
    await openContentLanguageMenu(canvasElement);
    expect(contentLanguageOptionLabels(canvasElement)).toEqual([
      "English",
      "Dutch",
      "French",
      "Add language…",
    ]);

    // The field's own label (sh:name) is chrome, driven by the interface language - it must not
    // move just because the content language switcher did (that's the whole point of having two
    // separate switchers: you can view/edit content in a different language than the UI itself).
    expect(findFieldLabel(canvasElement)).toHaveTextContent("Preferred label");
    expect(await findFieldInput(canvasElement)).toHaveValue("Redhead");

    await pickContentLanguage(canvasElement, "nl");
    expect(findFieldLabel(canvasElement)).toHaveTextContent("Preferred label");
    expect(await findFieldInput(canvasElement)).toHaveValue("Roodharige");

    // Switching to a language declared on the shape but with no value yet leaves an empty field
    // ready for a new translation, rather than showing nothing or carrying over the previous
    // language's text - the label is still unaffected. In the default "switcher" languageMode
    // there is exactly one language shown at a time, so no per-value language <select> renders
    // at all (see language-mode.stories.tsx for "individual" mode, which shows one instead).
    await openContentLanguageMenu(canvasElement);
    await pickContentLanguage(canvasElement, "fr");
    expect(findFieldLabel(canvasElement)).toHaveTextContent("Preferred label");
    expect(await findFieldInput(canvasElement)).toHaveValue("");
    expect(canvasElement.querySelector(".st-property-object__widget select")).toBeNull();

    // Typing a French translation and leaving must tag it "fr", not overwrite en/nl, and it must
    // still be there when navigating away and back.
    const input = await findFieldInput(canvasElement);
    await userEvent.type(input, "Rousse");
    await userEvent.tab();

    await openContentLanguageMenu(canvasElement);
    await pickContentLanguage(canvasElement, "en");
    expect(await findFieldInput(canvasElement)).toHaveValue("Redhead");

    await openContentLanguageMenu(canvasElement);
    await pickContentLanguage(canvasElement, "fr");
    await canvas.findByDisplayValue("Rousse", {}, { timeout: 5000 });
  },
};

export const contentAndInterfaceLanguagesAreIndependent: Story = {
  name: "Content and interface language switchers are fully independent",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });

    // The two locales this package ships an .ftl bundle for (see l10n/locales.ts), plus "fr" -
    // sh:name is declared in French here too ("Nom préféré"@fr), and InterfaceLanguageSwitcher
    // also offers every language it finds on sh:name/sh:description in the shapes graph, not just
    // the ones with a bundled translation (see preprocess/languages.ts) - chrome text for "fr"
    // just falls back to English (see loadBundles' resolveLocale) while the field's own label
    // still switches, same as it does for "en-GB"/"nl-NL" below.
    expect(
      within(findInterfaceLanguageSwitcher(canvasElement))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["English", "Nederlands", "français"]);

    expect(findFieldLabel(canvasElement)).toHaveTextContent("Preferred label");
    expect(await findFieldInput(canvasElement)).toHaveValue("Redhead");

    // Switching the UI to Dutch changes the field's own label (sh:name) but must not touch which
    // translation of the actual value is shown - that's still governed by the content switcher,
    // untouched here and still on "en". Switching the interface language reloads its Fluent
    // bundle (see L10nProvider), which briefly suspends and remounts the whole tree below it -
    // findByText waits that out, and every element is re-queried afterwards rather than reusing
    // a reference that may point at a now-detached node.
    await userEvent.selectOptions(findInterfaceLanguageSwitcher(canvasElement), "nl-NL");
    await canvas.findByText("Voorkeursnaam", {}, { timeout: 5000 });
    expect(await findFieldInput(canvasElement)).toHaveValue("Redhead");
    expect(activeContentLanguage(canvasElement)).toBe("en");

    // Switching content language to "nl" on top of that shows the Dutch value while the label -
    // already Dutch from the interface switch above - stays exactly as it was. Plain state, no
    // suspense/remount involved, so no wait is needed here.
    await openContentLanguageMenu(canvasElement);
    await pickContentLanguage(canvasElement, "nl");
    expect(findFieldLabel(canvasElement)).toHaveTextContent("Voorkeursnaam");
    expect(await findFieldInput(canvasElement)).toHaveValue("Roodharige");

    // Switching the UI back to English only moves the label - the Dutch value stays shown, since
    // the content switcher is still on "nl".
    await userEvent.selectOptions(findInterfaceLanguageSwitcher(canvasElement), "en-GB");
    await canvas.findByText("Preferred label", {}, { timeout: 5000 });
    expect(await findFieldInput(canvasElement)).toHaveValue("Roodharige");
  },
};
