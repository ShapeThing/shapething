import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/SHACL UI 1.2/10. Built-in Widgets/10.1 Editors/10.1.9 shui:IRIEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiIRIEditor: Story = {
  name: "Free-text IRI entry",
  args: argsByTestFile("10.1.9 shui-iri-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // A non-image IRI (https://example.org/more-info) must not render a preview thumbnail.
    expect(canvasElement.querySelector(".st-iri-editor__preview")).toBeNull();
  },
};

export const shuiIRIEditorImagePreview: Story = {
  name: "An image-extension IRI previews as a thumbnail",
  args: argsByTestFile("10.1.9.a shui-iri-editor-image-preview.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const input = await canvas.findByDisplayValue(/hendrik\.svg$/);
    expect(input).toBeVisible();

    const preview = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLImageElement>(
        ".st-iri-editor__preview-image",
      );
      if (!element) throw new Error("Could not find the image preview");
      return element;
    });
    expect(preview.src).toMatch(/hendrik\.svg$/);
  },
};

export const shuiIRIEditorSuggestions: Story = {
  name: "Autocomplete suggests IRIs already used elsewhere in the graph",
  args: argsByTestFile("10.1.9.b shui-iri-editor-suggestions.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // ex:relatedProject <http://example.org/project-alpha> lives elsewhere in this fixture's data
    // graph (not on "See also" itself) - knownIris() scans every quad position across the whole
    // graph, not just this property's own values, so it still shows up here.
    const seeAlsoField = await canvas.findByRole("combobox", { name: "See also" });
    await userEvent.type(seeAlsoField, "project-alpha");

    const suggestion = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>('[data-group="local"]');
      if (!element) throw new Error("Could not find the 'already in use' suggestion");
      return element;
    });
    expect(suggestion.textContent).toContain("http://example.org/project-alpha");

    await userEvent.click(suggestion);

    // Committed immediately (no Save button - this is a live-editing widget, unlike
    // PathItemModal's own add/edit form), so the field's value is the full IRI right away.
    expect(seeAlsoField).toHaveValue("http://example.org/project-alpha");

    // A field scoping its LOV half via st:iriType (see iriType.ts) still offers the very same
    // local match - st:iriType only ever restricts the remote LOV search, never the local
    // "already in use" half (see useLovSuggestions.ts).
    const relatedTypeField = await canvas.findByRole("combobox", { name: "Related type" });
    await userEvent.type(relatedTypeField, "project-alpha");
    await waitFor(() => {
      const element = canvasElement.querySelectorAll<HTMLElement>('[data-group="local"]');
      if (element.length === 0) throw new Error("Could not find the 'already in use' suggestion");
    });
  },
};
