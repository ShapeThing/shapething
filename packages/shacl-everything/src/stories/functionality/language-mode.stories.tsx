import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Functionality/Language mode (switcher vs individual)",
  component: ShaclRenderer,
};

// Same shape as content-language-switching.stories.tsx: two existing translations (en, nl) plus
// a third language (fr) declared via sh:languageIn/sh:name but with no value yet.
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

const baseArgs = {
  shapesGraph: shapesAndData,
  dataGraph: shapesAndData,
  nodeShapes: [factory.namedNode("http://example.com/shape")],
  focusNode: factory.namedNode("http://example.com/data"),
};

function findAllFieldInputs(canvasElement: HTMLElement): HTMLInputElement[] {
  return Array.from(
    canvasElement.querySelectorAll<HTMLInputElement>(".st-property-object__widget input.st-input"),
  );
}

// Scoped to plain ".st-select-wrapper" (no "-small" modifier), since focusing a value can also
// mount its WidgetSwitcher fly-out inside the same ".st-property-object__widget" wrapper, and
// that one uses the "-small" variant (see WidgetSwitcher.tsx) - this excludes it.
function findPerValueLanguageSelects(canvasElement: HTMLElement): HTMLSelectElement[] {
  return Array.from(
    canvasElement.querySelectorAll<HTMLSelectElement>(
      ".st-property-object__widget > .st-select-wrapper:not(.st-select-wrapper-small) select",
    ),
  );
}

export const switcherModeShowsOneTranslationAtATime: Story = {
  name: '"switcher" languageMode (the default): one global switcher, one value at a time, no per-value selectors',
  args: { ...baseArgs, languageMode: "switcher" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });

    expect(canvasElement.querySelector(".st-content-language-switcher")).not.toBeNull();
    expect(findAllFieldInputs(canvasElement)).toHaveLength(1);
    expect(findPerValueLanguageSelects(canvasElement)).toHaveLength(0);

    const languageSwitcher = canvasElement.querySelector<HTMLSelectElement>(
      ".st-content-language-switcher select",
    )!;
    await userEvent.selectOptions(languageSwitcher, "nl");
    expect(findAllFieldInputs(canvasElement)).toHaveLength(1);
    expect(findAllFieldInputs(canvasElement)[0]).toHaveValue("Roodharige");
    expect(findPerValueLanguageSelects(canvasElement)).toHaveLength(0);
  },
};

export const individualModeShowsEveryTranslationAtOnce: Story = {
  name: '"individual" languageMode: every translation renders side by side, each with its own language selector, no global switcher',
  args: { ...baseArgs, languageMode: "individual" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("Roodharige", {}, { timeout: 5000 });

    // No global switcher at all - there's nothing for it to pick between when every language is
    // already shown at once.
    expect(canvasElement.querySelector(".st-content-language-switcher")).toBeNull();

    const inputs = findAllFieldInputs(canvasElement);
    expect(inputs.map((input) => input.value).sort()).toEqual(["Redhead", "Roodharige"].sort());

    const selects = findPerValueLanguageSelects(canvasElement);
    expect(selects).toHaveLength(2);
    expect(selects.map((select) => select.value).sort()).toEqual(["en", "nl"]);

    // Retagging one value's language via its own selector changes only that value - the other
    // translation stays exactly as it was, and nothing disappears (individual mode never filters
    // by an "active" language in the first place).
    const enSelect = selects.find((select) => select.value === "en")!;
    await userEvent.selectOptions(enSelect, "fr");

    await canvas.findByDisplayValue("Roodharige", {}, { timeout: 5000 });
    const inputsAfterRetag = findAllFieldInputs(canvasElement);
    expect(inputsAfterRetag.map((input) => input.value).sort()).toEqual(
      ["Redhead", "Roodharige"].sort(),
    );
    const selectsAfterRetag = findPerValueLanguageSelects(canvasElement);
    expect(selectsAfterRetag.map((select) => select.value).sort()).toEqual(["fr", "nl"]);
  },
};
