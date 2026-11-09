import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:orderDirection st:Descending next to st:orderBy: view mode lists the values from the highest
// position to the lowest (see structure/orderByValues.ts's sortForView). Values without a position
// stay last.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:orderDirection",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "view" },
};

const linkTexts = (element: HTMLElement) =>
  within(element)
    .getAllByRole("link")
    .map((link) => link.textContent);

export const stOrderDirectionDescending: Story = {
  name: "View mode - the highest position first",
  args: argsByTestFile("st-order-direction.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const books = (await canvas.findByText("Books")).closest(".st-form-element") as HTMLElement;
    await waitFor(() =>
      expect(linkTexts(books)).toEqual(["Famous", "Well known", "Rarely cited", "Not counted"]),
    );
  },
};
