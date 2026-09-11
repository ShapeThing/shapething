import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
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
