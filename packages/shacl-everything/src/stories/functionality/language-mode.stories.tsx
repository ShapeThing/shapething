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

const baseArgs = {
  shapesGraph: shapesAndData,
  dataGraph: shapesAndData,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

function findAllFieldInputs(canvasElement: HTMLElement): HTMLInputElement[] {
  return Array.from(
    canvasElement.querySelectorAll<HTMLInputElement>(".st-property-object__widget input.st-input"),
  );
}

// Scoped to direct children of .st-property-object__widget - WidgetSwitcher/LogicalConstraintSwitcher
// render inside their own .st-property-object__fly-out wrapper one level deeper, so the `>` alone
// excludes them without needing to key off the shared "small" sizing modifier (which the per-value
// language trigger also legitimately carries).
function findPerValueLanguageTriggers(canvasElement: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    canvasElement.querySelectorAll<HTMLButtonElement>(
      ".st-property-object__widget > .st-listbox__wrapper .st-listbox__trigger",
    ),
  );
}

async function retagLanguage(
  canvasElement: HTMLElement,
  trigger: HTMLButtonElement,
  toValue: string,
): Promise<void> {
  await userEvent.click(trigger);
  const option = canvasElement.querySelector<HTMLElement>(`[data-value="${toValue}"]`);
  if (!option) throw new Error(`Could not find language option "${toValue}"`);
  await userEvent.click(option);
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

export const switcherModeShowsOneTranslationAtATime: Story = {
  name: '"switcher" languageMode (the default): one global switcher, one value at a time, no per-value selectors',
  args: { ...baseArgs, languageMode: "switcher" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });

    expect(canvasElement.querySelector(".st-content-language-switcher")).not.toBeNull();
    expect(findAllFieldInputs(canvasElement)).toHaveLength(1);
    expect(findPerValueLanguageTriggers(canvasElement)).toHaveLength(0);

    await pickContentLanguage(canvasElement, "nl");
    expect(findAllFieldInputs(canvasElement)).toHaveLength(1);
    expect(findAllFieldInputs(canvasElement)[0]).toHaveValue("Roodharige");
    expect(findPerValueLanguageTriggers(canvasElement)).toHaveLength(0);
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

    const triggers = findPerValueLanguageTriggers(canvasElement);
    expect(triggers).toHaveLength(2);
    expect(triggers.map((t) => t.dataset.value).sort()).toEqual(["en", "nl"]);

    // Retagging one value's language via its own selector changes only that value - the other
    // translation stays exactly as it was, and nothing disappears (individual mode never filters
    // by an "active" language in the first place).
    const enTrigger = triggers.find((t) => t.dataset.value === "en")!;
    await retagLanguage(canvasElement, enTrigger, "fr");

    await canvas.findByDisplayValue("Roodharige", {}, { timeout: 5000 });
    const inputsAfterRetag = findAllFieldInputs(canvasElement);
    expect(inputsAfterRetag.map((input) => input.value).sort()).toEqual(
      ["Redhead", "Roodharige"].sort(),
    );
    const triggersAfterRetag = findPerValueLanguageTriggers(canvasElement);
    expect(triggersAfterRetag.map((t) => t.dataset.value).sort()).toEqual(["fr", "nl"]);
  },
};
