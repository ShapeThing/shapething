import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:DrawerPropertyGroup is a ShapeThing-original group widget, not part of the SHACL core 1.2
// spec or the shui: extension proposal (unlike sh:PropertyGroup itself, see "SHACL UI 1.2"'s 8.7
// story) - it lives in its own stories folder rather than alongside the spec-conformance suite.
export default {
  title: "Specifications/ShapeThing (living document)/Groups/st:DrawerPropertyGroup",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

function findAddTrigger(canvasElement: HTMLElement): HTMLInputElement {
  const trigger = canvasElement.querySelector<HTMLInputElement>(
    ".st-drawer-property-group__add .st-listbox__trigger",
  );
  if (!trigger) throw new Error("expected the add-property combobox's trigger to render");
  return trigger;
}

function findOptions(canvasElement: HTMLElement): HTMLElement[] {
  return [
    ...canvasElement.querySelectorAll<HTMLElement>(
      ".st-drawer-property-group__add [role='option']",
    ),
  ];
}

function findOption(canvasElement: HTMLElement, name: string): HTMLElement {
  const option = findOptions(canvasElement).find((element) => element.textContent === name);
  if (!option) throw new Error(`expected an add-property option named "${name}"`);
  return option;
}

export const stDrawerPropertyGroup: Story = {
  name: "A group hiding its own still-empty optional properties behind a searchable add-property combobox",
  args: argsByTestFile("st-drawer-property-group.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The already-filled-in "Given name" renders as usual, but "Email"/"Phone number" - both still
    // empty - are nowhere in the document at all: unlike an ordinary group, which would show an
    // empty widget for every optional property immediately (see PropertyUIComponentValues), this
    // group holds them back behind its own add-property combobox instead.
    expect(await canvas.findByDisplayValue("Hendrik")).toBeInTheDocument();
    expect(canvas.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(canvas.queryByLabelText("Phone number")).not.toBeInTheDocument();

    const trigger = findAddTrigger(canvasElement);
    await userEvent.click(trigger);
    await waitFor(() => findOption(canvasElement, "Email"));
    findOption(canvasElement, "Phone number");

    // Typing filters the option list live (case-insensitively) - the point of a combobox over a
    // plain click-to-open list once a group can hold hundreds of optional properties (the RDA-FR
    // showcase runs up to ~300).
    await userEvent.type(trigger, "pho");
    await waitFor(() => {
      const options = findOptions(canvasElement);
      if (options.length !== 1) throw new Error("expected filtering to leave one option");
    });
    findOption(canvasElement, "Phone number");
    expect(canvasElement.querySelector("[role='option']")?.textContent).not.toBe("Email");

    await userEvent.clear(trigger);
    await waitFor(() => findOption(canvasElement, "Email"));
    await userEvent.click(findOption(canvasElement, "Email"));

    // Picking "Email" creates a fresh empty value for it - moving it out of the drawer and into the
    // ordinary rendering path, and out of the combobox's own remaining options, since it's no
    // longer unused. "Phone number" is untouched either way.
    expect(await canvas.findByLabelText("Email")).toBeInTheDocument();
    await userEvent.click(findAddTrigger(canvasElement));
    await waitFor(() => {
      const options = findOptions(canvasElement);
      if (options.length !== 1) throw new Error("expected exactly one option left in the combobox");
    });
    findOption(canvasElement, "Phone number");
  },
};
