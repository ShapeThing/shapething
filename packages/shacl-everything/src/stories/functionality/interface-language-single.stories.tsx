import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/Interface language switcher visibility",
  component: ShaclRenderer,
};

// Same shape as content-language-switching.stories.tsx: a langString property with two existing
// translations (en, nl) - exercises TextFieldWithLangEditor's own content-language handling,
// which is entirely separate from the *interface* language covered here.
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
        sh:name "Preferred label"@en, "Voorkeursnaam"@nl ;
        sh:path skos:prefLabel ;
        sh:datatype rdf:langString ;
        sh:languageIn ( "en" "nl" ) ;
    ] ;
    .

ex:data
    a schema:Person ;
    schema:givenName "Hendrik" ;
    skos:prefLabel "Redhead"@en, "Roodharige"@nl ;
    .
`;

const baseArgs = {
  shapesGraph: shapesAndData,
  dataGraph: shapesAndData,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

// Same as shapesAndData, but sh:name is English-only - InterfaceLanguageSwitcher also picks up
// sh:name/sh:description languages from the shapes graph (see preprocess/languages.ts), so a
// bilingual sh:name here would keep "nl" available even with the nl-NL .ftl locale removed below,
// defeating the "down to one" premise of oneInterfaceLanguageHidesTheSwitcher. The data stays
// bilingual, since that story also asserts the content language (an unrelated concern) still works.
const singleInterfaceLanguageShapesAndData = `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.
@prefix schema: <http://schema.org/>.
@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix ex: <http://example.org/>.

ex:shape
    a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
        sh:name "Preferred label"@en ;
        sh:path skos:prefLabel ;
        sh:datatype rdf:langString ;
        sh:languageIn ( "en" "nl" ) ;
    ] ;
    .

ex:data
    a schema:Person ;
    schema:givenName "Hendrik" ;
    skos:prefLabel "Redhead"@en, "Roodharige"@nl ;
    .
`;

function findFieldInput(canvasElement: HTMLElement): HTMLInputElement {
  const input = canvasElement.querySelector<HTMLInputElement>(
    ".st-property-object__widget input.st-input",
  );
  if (!input) throw new Error("Could not find the property's text input");
  return input;
}

// The content language switcher is a custom listbox rather than a native <select> (its rows need
// room for a per-language delete button - see ContentLanguageSwitcher) - opening it and clicking
// the row for `language` is the equivalent of userEvent.selectOptions on a native select.
async function pickContentLanguage(canvasElement: HTMLElement, language: string): Promise<void> {
  const trigger = canvasElement.querySelector<HTMLButtonElement>(
    ".st-content-language-switcher__trigger",
  );
  if (!trigger) throw new Error("Could not find the content language switcher");
  await userEvent.click(trigger);
  const option = canvasElement.querySelector<HTMLElement>(
    `.st-content-language-switcher [data-value="${language}"]`,
  );
  if (!option) throw new Error(`Could not find content language option "${language}"`);
  await userEvent.click(option);
}

export const twoInterfaceLanguagesShowsTheSwitcher: Story = {
  name: "Default (both built-in interface locales available): InterfaceLanguageSwitcher renders",
  args: baseArgs as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    expect(canvasElement.querySelector(".st-interface-language-switcher")).not.toBeNull();
  },
};

export const oneInterfaceLanguageHidesTheSwitcher: Story = {
  name: "Removing a built-in locale via interfaceLocales down to one: InterfaceLanguageSwitcher renders nothing, content language still works",
  args: {
    ...baseArgs,
    shapesGraph: singleInterfaceLanguageShapesAndData,
    dataGraph: singleInterfaceLanguageShapesAndData,
    // `null` removes a built-in locale entirely (see l10n/locales.ts#mergeLocaleLoaders) rather
    // than just overriding its translations - here it leaves only "en-GB", and the shapes graph's
    // own sh:name is English-only too, so there is nothing left for InterfaceLanguageSwitcher to
    // switch between and it renders nothing at all (see its `interfaceLanguages.length > 1`
    // check). This is independent of the field's own *content* languages (en, nl) above, which
    // are unaffected and still switch normally.
    interfaceLocales: { "nl-NL": null },
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });

    expect(canvasElement.querySelector(".st-interface-language-switcher")).toBeNull();

    await pickContentLanguage(canvasElement, "nl");
    expect(findFieldInput(canvasElement)).toHaveValue("Roodharige");
  },
};
