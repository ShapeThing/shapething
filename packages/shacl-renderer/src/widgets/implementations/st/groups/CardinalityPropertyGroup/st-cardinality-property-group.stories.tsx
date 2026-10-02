import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:CardinalityPropertyGroup groups a meta shape's sh:minCount and sh:maxCount properties - a
// "meta shape" describing sh:PropertyShape itself, which every fixture here mirrors in miniature.
export default {
  title: "Specifications/ShapeThing (living document)/Groups/st:CardinalityPropertyGroup",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

// The Minimum/Maximum fields are the group's own child properties, rendered by their usual widget
// inside <details> - `hidden: true` because a collapsed <details> keeps them out of the
// accessibility tree while they're still in the DOM.
async function findGroup(root: HTMLElement) {
  const group = await within(root).findByRole("group", { name: "Cardinality" });
  const advanced = group.querySelector<HTMLDetailsElement>("details")!;
  const scope = within(advanced);
  return {
    required: within(group).getByRole("checkbox", { name: "Required" }),
    multiple: within(group).getByRole("checkbox", { name: "Multiple" }),
    advanced,
    summary: advanced.querySelector<HTMLElement>("summary")!,
    min: await scope.findByRole("spinbutton", { name: "Minimum", hidden: true }),
    max: await scope.findByRole("spinbutton", { name: "Maximum", hidden: true }),
  };
}

export const stCardinalityPropertyGroup: Story = {
  name: "Required, single value: advanced stays collapsed",
  args: argsByTestFile("st-cardinality-property-group.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const group = await findGroup(canvasElement);
    // Shown as one ordinary field: a FormElement label, not a group title.
    const field = canvasElement.querySelector(".st-cardinality-property-group")!;
    expect(field).toHaveClass("st-form-element");
    expect(field.querySelector(":scope > .st-form-element__header")).toHaveTextContent("Cardinality");
    expect(canvasElement.querySelector(".st-property-group__title")).toBeNull();
    expect(group.required).toBeChecked();
    expect(group.multiple).not.toBeChecked();
    expect(group.advanced.open).toBe(false);
    expect(group.min).toHaveValue(1);
    expect(group.max).toHaveValue(1);
  },
};

export const stCardinalityPropertyGroupEmpty: Story = {
  name: "No counts yet: optional and multiple, advanced collapsed",
  args: argsByTestFile("st-cardinality-property-group-empty.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const group = await findGroup(canvasElement);
    expect(group.required).not.toBeChecked();
    expect(group.multiple).toBeChecked();
    expect(group.advanced.open).toBe(false);
    expect(group.min).toHaveValue(null);
    expect(group.max).toHaveValue(null);
  },
};

export const stCardinalityPropertyGroupAdvanced: Story = {
  name: "Counts other than 1: advanced opens",
  args: argsByTestFile("st-cardinality-property-group-advanced.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const group = await findGroup(canvasElement);
    expect(group.advanced.open).toBe(true);
    expect(group.required).toBeChecked();
    expect(group.multiple).toBeChecked();
    expect(group.min).toHaveValue(2);
    expect(group.max).toHaveValue(5);
  },
};

export const stCardinalityPropertyGroupToggleCheckboxes: Story = {
  name: "The checkboxes write sh:minCount and sh:maxCount",
  args: argsByTestFile("st-cardinality-property-group-empty.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const group = await findGroup(canvasElement);

    await userEvent.click(group.required);
    await waitFor(() => expect(group.required).toBeChecked());
    await waitFor(async () =>
      expect(
        await within(group.advanced).findByRole("spinbutton", { name: "Minimum", hidden: true }),
      ).toHaveValue(1),
    );

    await userEvent.click(group.multiple);
    await waitFor(() => expect(group.multiple).not.toBeChecked());
    await waitFor(async () =>
      expect(
        await within(group.advanced).findByRole("spinbutton", { name: "Maximum", hidden: true }),
      ).toHaveValue(1),
    );

    // Only 1s so far - nothing the checkboxes can't show, so advanced stays collapsed.
    expect(group.advanced.open).toBe(false);

    await userEvent.click(group.required);
    await waitFor(() => expect(group.required).not.toBeChecked());
  },
};

export const stCardinalityPropertyGroupUncheckMultipleCapsMinimum: Story = {
  name: "Unchecking Multiple lowers a minimum above 1",
  args: argsByTestFile("st-cardinality-property-group-advanced.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const group = await findGroup(canvasElement);
    await userEvent.click(group.multiple);
    await waitFor(() => expect(group.multiple).not.toBeChecked());
    await waitFor(() => expect(group.max).toHaveValue(1));
    expect(group.min).toHaveValue(1);
    expect(group.required).toBeChecked();
  },
};

export const stCardinalityPropertyGroupTypeMaximum: Story = {
  name: "Typing a maximum in the advanced section updates Multiple",
  args: argsByTestFile("st-cardinality-property-group.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const group = await findGroup(canvasElement);
    await userEvent.click(group.summary);
    await waitFor(() => expect(group.advanced.open).toBe(true));

    await userEvent.clear(group.max);
    await userEvent.type(group.max, "4");
    await userEvent.tab();

    await waitFor(() => expect(group.multiple).toBeChecked());
    expect(group.advanced.open).toBe(true);
  },
};
