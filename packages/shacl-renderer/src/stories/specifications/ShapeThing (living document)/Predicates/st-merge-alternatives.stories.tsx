import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:mergeAlternatives is a plain sibling triple on a shui:LabelRole property shape (see
// resolution/label.ts's resolveLabelRolePathParts): it opts that property's sh:alternativePath
// into "combine every branch" instead of SHACL's "first branch with a value wins". A branch
// landing on a resource (schema:unitCode) resolves to that resource's own label; an empty branch
// is skipped.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:mergeAlternatives",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "view" },
};

export const stMergeAlternatives: Story = {
  name: "Quantity, unit and name merged into one label",
  args: argsByTestFile("st-merge-alternatives.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText("500 Gram Puff pastry")).resolves.toBeVisible();
    await expect(canvas.findByText("2 Egg yolks")).resolves.toBeVisible();
  },
};

export const stMergeAlternativesOff: Story = {
  name: "Without st:mergeAlternatives - first branch wins",
  args: {
    ...argsByTestFile("st-merge-alternatives.ttl", import.meta.url),
    nodeShapes: [
      factory.namedNode(fixtureUrl("st-merge-alternatives.ttl#plainShape", import.meta.url).href),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText("500")).resolves.toBeVisible();
    await expect(canvas.findByText("2")).resolves.toBeVisible();
    expect(canvas.queryByText(/Puff pastry/)).toBeNull();
  },
};
