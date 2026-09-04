import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Interaction/Edit and create in place",
  component: ShaclRenderer,
};

// enableEditInPlace/enableCreateInPlace already default to true (see defaultEnvironment), but are
// spelled out here since they're the whole point of this fixture.
const args: ShaclRendererProps = {
  ...argsByTestFile("edit-and-create-in-place.ttl", import.meta.url),
  enableEditInPlace: true,
  enableCreateInPlace: true,
};

export const creatingANewReferenceInPlace: Story = {
  name: "Creating a new reference in place (shui:AutoCompleteEditor)",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Publisher starts unset - clicking AutoCompleteEditor's own empty-state placeholder switches
    // it into edit mode, the same as clicking its search icon would.
    await userEvent.click(await canvas.findByText("- Select an option -"));

    const input = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLInputElement>(
        ".st-autocomplete input.st-input",
      );
      if (!element) throw new Error("Could not find the AutoCompleteEditor search input");
      return element;
    });
    expect(input).toHaveFocus();

    // The "Create new…" row is offered as soon as the field is focused - it doesn't need a search
    // term typed first, since canCreate only depends on enableCreateInPlace/sh:class, not `search`.
    await userEvent.click(await canvas.findByText("Create new…"));

    const dialog = await canvas.findByRole("dialog");
    const dialogScope = within(dialog);
    await expect(dialogScope.findByText("New item")).resolves.toBeVisible();

    // The freshly minted subject has no fields yet - fill in its Name (organizationShape's own
    // LabelRole property) before adopting it. TextFieldEditor only commits on blur (see
    // useDeferredInput), hence the trailing tab.
    await userEvent.type(dialogScope.getByRole("textbox"), "Umbrella Corp");
    await userEvent.tab();

    await userEvent.click(dialogScope.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());

    // Submitting adopts the new subject as this property's value and resolves its just-written
    // label back onto the closed trigger, the same way picking an ordinary search result would.
    await expect(canvas.findByText("Umbrella Corp")).resolves.toBeVisible();
  },
};

export const editingTheSelectedReferenceInPlace: Story = {
  name: "Editing the selected reference in place (shui:EnumSelectEditor)",
  args,
  play: async ({ canvasElement }) => {
    const trigger = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(".st-enum-select__trigger");
      if (!element) throw new Error("Could not find the EnumSelectEditor trigger");
      return element;
    });

    // The currently selected value (ex:Acme, already in the data graph and described by
    // organizationShape) shows its own edit-in-place icon on the closed trigger.
    const editButton = await within(trigger).findByRole("button");
    expect(editButton).toBeVisible();

    // AutoCompleteOption's resourceEditor modal is portaled to <body> (see its own comment on
    // why), unlike AutoCompleteEditor's create modal above.
    await userEvent.click(editButton);
    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    const dialogScope = within(dialog);
    const nameInput = await dialogScope.findByDisplayValue("Acme Corp");

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "AcmeCorpRenamed");
    await userEvent.tab();
    await expect(dialogScope.findByDisplayValue("AcmeCorpRenamed")).resolves.toBeVisible();

    // Submitting commits the staged edit straight to the shared data graph and closes without
    // asking for confirmation (nothing is being discarded).
    await userEvent.click(dialogScope.getByRole("button", { name: /update/i }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

    // The trigger's own label comes from a react-query cache, not dataGraph's reactivity - a
    // commit has to invalidate it explicitly for this to update at all (see AutoCompleteOption's
    // commitEditor).
    await expect(within(trigger).findByText("AcmeCorpRenamed")).resolves.toBeVisible();
  },
};
