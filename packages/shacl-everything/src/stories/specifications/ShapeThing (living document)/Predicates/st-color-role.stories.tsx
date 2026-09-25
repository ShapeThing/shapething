import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:ColorRole is a ShapeThing-original shui:propertyRole value marking which property holds a
// swatch color. Unlike the other roles it's resolved off the value's OWN rdf:type (see
// resolution/label.ts's valueNodeColor), not the enclosing property's sh:node/sh:class.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:ColorRole",
  component: ShaclRenderer,
};

// A ClassificationRole chip (the "Transport" skos:ConceptScheme) is colored via a shape targeting
// skos:ConceptScheme itself.
export const stColorRoleClassificationChip: Story = {
  name: "Classification chip colored via st:ColorRole",
  args: argsByTestFile("st-color-role-classification.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.findByText("Transport")).resolves.toBeVisible();
    const chip = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(".st-value-chip");
      if (!element) throw new Error("Could not find the classification chip");
      return element;
    });

    expect(chip.className).toContain("st-value-chip--colored--1");
    expect(chip.style.getPropertyValue("--color-0")).toBe("#22c55e");
  },
};

// Same chip, but the swatch is an st:ColorEditor-style HSL blank node instead of a CSS literal -
// resolved to hex the same way st:ColorViewer displays it.
export const stColorRoleClassificationChipHsl: Story = {
  name: "Classification chip colored via an HSL st:ColorRole node",
  args: argsByTestFile("st-color-role-classification-hsl.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.findByText("Transport")).resolves.toBeVisible();
    const chip = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(".st-value-chip");
      if (!element) throw new Error("Could not find the classification chip");
      return element;
    });

    expect(chip.className).toContain("st-value-chip--colored--1");
    expect(chip.style.getPropertyValue("--color-0")).toBe("#a855f7");
  },
};

// st:CategoryFacet applies the same lookup to each option value directly.
export const stColorRoleCategoryFacet: Story = {
  name: "Facet options show a st:ColorRole swatch",
  args: { ...argsByTestFile("st-color-role-facet.ttl", import.meta.url), mode: "facet" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const swatchOf = async (label: string) => {
      const input = await canvas.findByLabelText(label);
      const swatch = input
        .closest("label")
        ?.querySelector<HTMLElement>(".st-category-facet__swatch");
      if (!swatch) throw new Error(`Could not find ${label}'s own swatch`);
      return swatch;
    };

    expect(getComputedStyle(await swatchOf("Electronics")).backgroundColor).toBe(
      "rgb(59, 130, 246)",
    );
    expect(getComputedStyle(await swatchOf("Books")).backgroundColor).toBe("rgb(245, 158, 11)");
  },
};
