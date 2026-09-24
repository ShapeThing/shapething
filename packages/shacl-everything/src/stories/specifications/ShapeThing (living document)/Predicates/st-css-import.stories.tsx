import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:cssImport on a sh:NodeShape loads extra, shape-authored CSS as a refcounted
// <link rel="stylesheet"> while any node rendering that shape is mounted (see
// resolution/cssImports.ts, helpers/stylesheetRegistry.ts). st-css-import.css outlines the shape's
// own property group in a dashed pink border.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:cssImport",
  component: ShaclRenderer,
};

function findGroup(canvasElement: HTMLElement): HTMLElement {
  const group = canvasElement.querySelector<HTMLElement>(
    '[data-iri="http://example.org/highlightedGroup"]',
  );
  if (!group) throw new Error("Could not find the highlighted property group");
  return group;
}

export const stCssImportEdit: Story = {
  name: "Shape stylesheet applied in edit mode",
  args: argsByTestFile("st-css-import.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(document.head.querySelector('link[rel="stylesheet"][href$="st-css-import.css"]'))
        .not.toBeNull();
    });
    await waitFor(() => {
      expect(getComputedStyle(findGroup(canvasElement)).outlineStyle).toBe("dashed");
    });
  },
};

export const stCssImportView: Story = {
  name: "Shape stylesheet applied in view mode",
  args: { ...argsByTestFile("st-css-import.ttl", import.meta.url), mode: "view" },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(getComputedStyle(findGroup(canvasElement)).outlineStyle).toBe("dashed");
    });
  },
};
