import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/sh:targetWhere",
  component: ShaclRenderer,
};

const args = argsByTestFile("target-where-sequence-path.ttl", import.meta.url);

async function chooseKind(canvasElement: HTMLElement, option: string) {
  const canvas = within(canvasElement);
  const trigger = await waitFor(() => {
    const element = canvasElement.querySelector<HTMLButtonElement>(".st-enum-select__trigger");
    if (!element) throw new Error("Could not find the Kind select's trigger");
    return element;
  });
  await userEvent.click(trigger);
  const listbox = await canvas.findByRole("listbox");
  await userEvent.click(within(listbox).getByRole("option", { name: option }));
}

export const fragmentsFollowAWriteDeeperAlongTheWherePath: Story = {
  name: "A sh:targetWhere fragment re-attaches when a value further along its sequence path changes",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // <details> ex:kind "A": FragmentAShape attaches, so its "Extra A" field shows "hello".
    await expect(canvas.findByDisplayValue("hello")).resolves.toBeVisible();
    expect(canvas.queryByText("Extra B")).toBeNull();

    // The write lands on <details>, not on the focus node - only a watch on the whole
    // (ex:details ex:kind) path, not just its first predicate, notices it.
    await chooseKind(canvasElement, "B");
    await waitFor(() => expect(canvas.queryByDisplayValue("hello")).toBeNull());
    await expect(canvas.findByText("Extra B")).resolves.toBeVisible();

    // And back again: FragmentAShape re-attaches, its untouched ex:extraA value still there.
    await chooseKind(canvasElement, "A");
    await expect(canvas.findByDisplayValue("hello")).resolves.toBeVisible();
    await waitFor(() => expect(canvas.queryByText("Extra B")).toBeNull());
  },
};
