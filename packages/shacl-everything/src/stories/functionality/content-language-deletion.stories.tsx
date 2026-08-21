import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Shacl Renderer/Functionality/Content language deletion",
  component: ShaclRenderer,
};

// Two separate langString properties, each with an "en" and "nl" translation - deleting a
// language must wipe it from every property across the whole data graph, not just whichever one
// happens to be visible/active, so this needs more than one property to actually prove that.
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
    ], [
        sh:name "Definition"@en, "Omschrijving"@nl ;
        sh:path skos:definition ;
        sh:datatype rdf:langString ;
        sh:languageIn ( "en" "nl" ) ;
    ] ;
    .

ex:data
    a schema:Person ;
    skos:prefLabel "Redhead"@en, "Roodharige"@nl ;
    skos:definition "A person with red hair"@en, "Een persoon met rood haar"@nl ;
    .
`;

const args: ShaclRendererProps = {
  shapesGraph: shapesAndData,
  dataGraph: shapesAndData,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

function findFieldInputs(canvasElement: HTMLElement): HTMLInputElement[] {
  return Array.from(
    canvasElement.querySelectorAll<HTMLInputElement>(".st-property-object__widget input.st-input"),
  );
}

function findContentLanguageTrigger(canvasElement: HTMLElement): HTMLButtonElement {
  const button = canvasElement.querySelector<HTMLButtonElement>(
    ".st-content-language-switcher .st-content-language-switcher__trigger",
  );
  if (!button) throw new Error("Could not find the content language switcher");
  return button;
}

async function openContentLanguageMenu(canvasElement: HTMLElement): Promise<void> {
  await userEvent.click(findContentLanguageTrigger(canvasElement));
}

function contentLanguageOptionLabels(canvasElement: HTMLElement): (string | null)[] {
  return Array.from(
    canvasElement.querySelectorAll(".st-content-language-switcher [role='option']"),
  ).map((option) => option.textContent);
}

async function pickContentLanguage(canvasElement: HTMLElement, language: string): Promise<void> {
  await openContentLanguageMenu(canvasElement);
  const option = canvasElement.querySelector<HTMLElement>(
    `.st-content-language-switcher [role='option'][data-value="${language}"]`,
  );
  if (!option) throw new Error(`Could not find content language option "${language}"`);
  await userEvent.click(option);
}

// The delete button lives inside its row, reachable by mouse only (see ContentLanguageSwitcher) -
// opening the menu first is required, same as picking a row. Scoped to [role='option'] rather than
// just [data-value] - the trigger button also carries data-value (for its own active language), so
// once `language` is the active one, an unscoped lookup would match the trigger instead of the row.
async function clickDeleteLanguage(canvasElement: HTMLElement, language: string): Promise<void> {
  await openContentLanguageMenu(canvasElement);
  const option = canvasElement.querySelector<HTMLElement>(
    `.st-content-language-switcher [role='option'][data-value="${language}"]`,
  );
  if (!option) throw new Error(`Could not find content language option "${language}"`);
  const deleteButton = option.querySelector<HTMLButtonElement>(
    ".st-content-language-switcher__delete",
  );
  if (!deleteButton) throw new Error(`Could not find the delete button for "${language}"`);
  await userEvent.click(deleteButton);
}

// CreateLanguageModal and DeleteLanguageModal both render a "dialog.st-modal" (the latter always
// mounted, just closed, whenever content-language creation is enabled - the default) - `[open]`
// picks out whichever of the two is actually showing rather than always matching the first one in
// DOM order.
function findDeleteConfirmModal(canvasElement: HTMLElement): HTMLElement {
  const dialog = canvasElement.querySelector<HTMLElement>("dialog.st-modal[open]");
  if (!dialog) throw new Error("Could not find the delete-language confirmation modal");
  return dialog;
}

export const deletingALanguageWipesItFromEveryProperty: Story = {
  name: "Confirming deletion removes a language's values from every property in the data graph",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("A person with red hair", {}, { timeout: 5000 });

    // Clicking the trash icon on a row opens a confirmation naming that language, rather than
    // deleting immediately - this is irreversible, unlike every other switcher action.
    await clickDeleteLanguage(canvasElement, "nl");
    expect(findDeleteConfirmModal(canvasElement)).toBeVisible();
    expect(findDeleteConfirmModal(canvasElement)).toHaveTextContent("Dutch");

    // Canceling leaves every value untouched.
    const cancelButton =
      findDeleteConfirmModal(canvasElement).querySelector<HTMLButtonElement>(
        "button.st-button--text",
      )!;
    await userEvent.click(cancelButton);
    expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull();

    await pickContentLanguage(canvasElement, "nl");
    expect(
      findFieldInputs(canvasElement)
        .map((input) => input.value)
        .sort(),
    ).toEqual(["Een persoon met rood haar", "Roodharige"].sort());

    // Confirming actually deletes - both Dutch translations disappear, not just the one on
    // whichever property happened to be visible when the delete was triggered.
    await clickDeleteLanguage(canvasElement, "nl");
    const confirmButton = findDeleteConfirmModal(canvasElement).querySelector<HTMLButtonElement>(
      "button.st-button--danger",
    )!;
    await userEvent.click(confirmButton);
    expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull();

    // Deleting the active language falls back to whatever's left (here, the only other one) -
    // there's nothing left to show in Dutch, so staying on it would leave every field looking
    // empty for no visible reason.
    expect(
      findFieldInputs(canvasElement)
        .map((input) => input.value)
        .sort(),
    ).toEqual(["A person with red hair", "Redhead"].sort());

    // The language itself is gone from the switcher too, not just its values - it served its
    // purpose (emptying the data) and re-adding it is one click away via "Add language…" if it's
    // ever needed again.
    await openContentLanguageMenu(canvasElement);
    expect(contentLanguageOptionLabels(canvasElement)).toEqual(["English", "Add language…"]);
  },
};
