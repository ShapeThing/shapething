import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:DatatypeEditor is a ShapeThing-original editor, not part of the SHACL 1.2 Core spec or the
// shui: extension proposal, so it lives alongside the other st: editors rather than the
// spec-conformance suite. It only ever activates for a property shape whose own sh:path is
// literally sh:datatype (see score.ttl) - i.e. a "meta shape" describing sh:PropertyShape itself,
// the way shacl-manager's own shape.ttl does, which every fixture here mirrors in miniature.
export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:DatatypeEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

function findDatatypePropertyContainer(root: ParentNode): HTMLElement {
  const label = [...root.querySelectorAll<HTMLElement>(".st-form-element__label-text")].find(
    (element) => element.textContent?.trim() === "Datatype",
  );
  const container = label?.closest<HTMLElement>(".st-form-element");
  if (!container) throw new Error("Could not find the 'Datatype' property's own container");
  return container;
}

// Not getByRole("button") - the property row also carries the WidgetSwitcher fly-out's own
// (icon-only, empty-text) toggle button once it's focused/hovered, so a bare role query can match
// that instead of SelectListbox's own trigger.
function findTrigger(container: HTMLElement): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>(".st-listbox__trigger");
  if (!element) throw new Error("Could not find the SelectListbox trigger");
  return element;
}

export const stDatatypeEditor: Story = {
  name: "A curated datatype already selected",
  args: argsByTestFile("st-datatype-editor.ttl", import.meta.url),
};

export const stDatatypeEditorEmpty: Story = {
  name: "No value yet",
  args: argsByTestFile("st-datatype-editor-empty.ttl", import.meta.url),
};

export const stDatatypeEditorCustomValue: Story = {
  name: "A non-curated/custom datatype IRI already set",
  args: argsByTestFile("st-datatype-editor-custom.ttl", import.meta.url),
};

export const stDatatypeEditorPickCuratedOption: Story = {
  name: "Picking a different curated option updates the trigger",
  args: argsByTestFile("st-datatype-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const container = await waitFor(() => findDatatypePropertyContainer(canvasElement));
    const trigger = await waitFor(() => findTrigger(container));
    expect(trigger).toHaveTextContent("Text");

    await userEvent.click(trigger);
    const listbox = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".st-listbox__listbox");
      if (!element) throw new Error("Could not find the open listbox");
      return element;
    });
    const options = within(listbox).getAllByRole("option");
    const booleanOption = options.find((option) => option.textContent?.startsWith("Boolean"));
    if (!booleanOption) throw new Error("Could not find the 'Boolean' option");
    await userEvent.click(booleanOption);

    expect(trigger).toHaveTextContent("Boolean");
    expect(container.querySelector(".st-listbox__listbox")).toBeNull();
  },
};

export const stDatatypeEditorUseCustomIri: Story = {
  name: '"Use custom IRI…" accepts a raw datatype IRI',
  args: argsByTestFile("st-datatype-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const container = await waitFor(() => findDatatypePropertyContainer(canvasElement));
    const trigger = await waitFor(() => findTrigger(container));
    await userEvent.click(trigger);

    const customRow = await waitFor(() => {
      const options = container.querySelectorAll<HTMLElement>('[role="option"]');
      const match = [...options].find((option) => option.textContent?.includes("custom IRI"));
      if (!match) throw new Error("Could not find the 'Use custom IRI…' row");
      return match;
    });
    await userEvent.click(customRow);

    const input = await waitFor(() => {
      const element = container.querySelector<HTMLInputElement>(
        ".st-datatype-editor--custom input",
      );
      if (!element) throw new Error("Could not find the custom IRI input");
      return element;
    });
    await userEvent.clear(input);
    await userEvent.type(input, "http://example.org/customDatatype{Enter}");

    // Back to the trigger view, now showing the freshly-typed custom IRI's own local name (it
    // isn't in the curated list, so there's no FTL translation for it - see widget.tsx's fallback).
    const triggerAfter = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".st-listbox__trigger");
      if (!element) throw new Error("Could not find the trigger after applying the custom IRI");
      return element;
    });
    expect(triggerAfter).toHaveTextContent("customDatatype");
  },
};
