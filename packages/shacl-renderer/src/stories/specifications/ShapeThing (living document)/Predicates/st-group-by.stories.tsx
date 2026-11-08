import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:groupBy on a property shape shows its values in groups in view mode, each under the text a
// property path reaches from its values (see structure/groupByValues.ts), composed by
// st:groupTemplate the way st:mergeTemplate composes a text. The groups keep st:orderBy's order.
export default {
  title: "Specifications/ShapeThing (living document)/Predicates/st:groupBy",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "view" },
};

const args = argsByTestFile("st-group-by.ttl", import.meta.url);

const groupsOf = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll<HTMLElement>(".st-value-group")].map((group) => ({
    key: group.querySelector(".st-value-group__label")?.textContent ?? "",
    items: within(group)
      .getAllByRole("link")
      .map((link) => link.textContent),
  }));

export const stGroupByView: Story = {
  name: "View mode - values grouped by the year of their date",
  args,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(groupsOf(canvasElement)).toEqual([
        { key: "1843", items: ["Either/Or", "Fear and Trembling"] },
        { key: "1849", items: ["The Sickness unto Death"] },
        { key: "", items: ["Papers"] },
      ]),
    );
  },
};

export const stGroupByEdit: Story = {
  name: "Edit mode - the values without groups",
  args: { ...args, mode: "edit" },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText("Books");
    expect(canvasElement.querySelector(".st-value-group")).toBeNull();
  },
};
