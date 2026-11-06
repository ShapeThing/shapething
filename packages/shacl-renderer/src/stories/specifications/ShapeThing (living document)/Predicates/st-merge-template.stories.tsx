import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:mergeAlternatives on a property shape itself, shaped by st:mergeTemplate (see
// resolution/composeAlternatives.ts): view mode shows one composed value - deterministic text
// built from structured data - instead of the values of every sh:alternativePath branch.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:mergeTemplate",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "view" },
};

export const stMergeTemplate: Story = {
  name: "Demonym, occupations and years composed into one value",
  args: argsByTestFile("st-merge-template.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The data's "en" content, joined in the en-GB interface language: no serial comma.
    await expect(
      canvas.findByText("Danish theologian, philosopher and poet (1813–1855)"),
    ).resolves.toBeVisible();
    // The branch values themselves are not listed separately.
    expect(canvas.queryByText("Denmark")).toBeNull();
    expect(canvas.queryByText("1813-05-05")).toBeNull();
  },
};

export const stMergeTemplateLiving: Story = {
  name: "An empty placeholder inside an optional section that still has a value",
  args: {
    ...argsByTestFile("st-merge-template.ttl", import.meta.url),
    focusNode: factory.namedNode(fixtureUrl("st-merge-template.ttl#living", import.meta.url).href),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText("poet (1950–)")).resolves.toBeVisible();
  },
};
