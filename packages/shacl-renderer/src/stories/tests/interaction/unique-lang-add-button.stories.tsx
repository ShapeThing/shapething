import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/Add button with sh:uniqueLang",
  component: ShaclRenderer,
};

// A sh:uniqueLang rdf:langString property, two existing translations (en, nl) and a third
// declared language (fr) with no value yet - same shape of fixture as language-mode.stories.tsx,
// plus sh:uniqueLang. See PropertyUIComponentAdd's uniqueLangBlocksAdd for why the "+" button
// must never appear in "switcher" languageMode here: it would always seed a fresh value tagged
// with the single active content language (see useDefaultObject), which for a uniqueLang property
// is either a value that already exists (a violation) or one the always-open empty widget already
// offers - never something a second control could usefully add.
const baseArgs = argsByTestFile("unique-lang-add-button.ttl", import.meta.url);

function findAddButton(canvasElement: HTMLElement): HTMLButtonElement | null {
  return within(canvasElement).queryByRole("button", { name: "Add value" }) as
    | HTMLButtonElement
    | null;
}

export const switcherModeHidesTheAddButton: Story = {
  name: '"switcher" languageMode: sh:uniqueLang hides the "+" button entirely, not just disables it',
  args: { ...baseArgs, languageMode: "switcher" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Active language (en) already has a value - the "+" button would otherwise be enabled here
    // (a second value exists to justify one), but must still be absent: a click would seed a
    // second "en"-tagged value, an immediate sh:uniqueLang violation.
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    expect(findAddButton(canvasElement)).toBeNull();
  },
};

export const individualModeStillShowsTheAddButton: Story = {
  name: '"individual" languageMode: sh:uniqueLang does not affect the "+" button - each value picks its own language',
  args: { ...baseArgs, languageMode: "individual" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Every existing translation renders side by side here, each with its own language picker
    // (ValueLanguageSelect) - a fresh value from "+" can still pick "fr", the one not yet used, so
    // the button stays available.
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("Roodharige", {}, { timeout: 5000 });
    expect(findAddButton(canvasElement)).not.toBeNull();
  },
};
