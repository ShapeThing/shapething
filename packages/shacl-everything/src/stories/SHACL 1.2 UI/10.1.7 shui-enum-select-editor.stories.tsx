import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title:
    "Shacl Renderer/SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.7 shui:EnumSelectEditor",
  component: ShaclRenderer,
  args: {
    ...minimalEnvironment,
    enableEditInPlace: true,
  },
};

export const shuiEnumSelectEditor1: Story = {
  name: "Drop-down of sh:in values",
  args: argsByTestFile("10.1.7 shui-enum-select-editor.ttl", import.meta.url),
};

export const shuiEnumSelectEditor2: Story = {
  name: "Federated values",
  args: argsByTestFile("10.1.7 shui-enum-select-editor-federated-data.ttl", import.meta.url),
};

export const shuiEnumSelectEditor3: Story = {
  name: "Edit the linked resource in place (sh:node)",
  args: argsByTestFile("10.1.7 shui-enum-select-editor-nested-resource.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(".st-enum-select__trigger");
      if (!element) throw new Error("Could not find the EnumSelectEditor trigger");
      return element;
    });
    const triggerScope = within(trigger);

    // The currently selected value shows its own edit-in-place icon.
    const editButton = await triggerScope.findByRole("button");
    expect(editButton).toBeVisible();

    // Opening the dropdown must not offer the icon on either option row - only the closed
    // trigger's own selected value gets it.
    await userEvent.click(trigger);
    const listbox = await canvas.findByRole("listbox");
    expect(within(listbox).queryByRole("button")).toBeNull();
    await userEvent.keyboard("{Escape}");

    // Clicking it opens the linked resource (ex:PrideAndPrejudice) in a modal, rendered through
    // its own shape (<#bookShape>) rather than just linking out to its bare IRI.
    await userEvent.click(editButton);
    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    const dialogScope = within(dialog);
    await expect(dialogScope.findByText("Pride and Prejudice")).resolves.toBeVisible();
    const authorInput = await dialogScope.findByDisplayValue("Jane Austen");
    expect(authorInput).toBeVisible();

    // Edits inside the modal go into a private staged copy, not the shared dataGraph directly -
    // trying to close without submitting must offer a chance to back out rather than silently
    // discarding (or silently keeping) them. TextFieldEditor only commits a value on blur (see
    // useDeferredInput), so the field needs to actually lose focus for the write to land - typing
    // then tabbing away is the realistic way to trigger that.
    await userEvent.clear(authorInput);
    await userEvent.type(authorInput, "JaneAustenEdited");
    await userEvent.tab();
    await expect(dialogScope.findByDisplayValue("JaneAustenEdited")).resolves.toBeVisible();

    const closeButton = dialogScope.getByRole("button", { name: /close/i });
    await userEvent.click(closeButton);
    const dialogs = await waitFor(() => {
      const found = body.queryAllByRole("dialog");
      if (found.length < 2) throw new Error(`Expected 2 dialogs, found ${found.length}`);
      return found;
    });
    const discardDialog = dialogs.find((element) => element !== dialog)!;
    const discardScope = within(discardDialog);

    // Backing out of the confirmation must leave both the editor open and the unsaved edit intact.
    await userEvent.click(discardScope.getByRole("button", { name: /keep editing/i }));
    await waitFor(() => expect(body.queryAllByRole("dialog")).toHaveLength(1));
    expect(dialog).toBeVisible();
    expect(dialogScope.getByDisplayValue("JaneAustenEdited")).toBeVisible();

    // Confirming discard must close everything and throw the staged edit away entirely - reopening
    // afterwards re-reads the real (untouched) dataGraph, not the discarded staging copy.
    await userEvent.click(closeButton);
    const reconfirmDialog = (
      await waitFor(() => {
        const found = body.queryAllByRole("dialog");
        if (found.length < 2) throw new Error(`Expected 2 dialogs, found ${found.length}`);
        return found;
      })
    ).find((element) => element !== dialog)!;
    await userEvent.click(within(reconfirmDialog).getByRole("button", { name: /^discard$/i }));
    await waitFor(() => expect(body.queryAllByRole("dialog")).toHaveLength(0));

    await userEvent.click(editButton);
    const reopenedDialog = await body.findByRole("dialog");
    await expect(within(reopenedDialog).findByDisplayValue("Jane Austen")).resolves.toBeVisible();

    // Submitting instead must both commit the change to the real dataGraph and close without
    // asking for confirmation.
    const secondAuthorInput = within(reopenedDialog).getByDisplayValue("Jane Austen");
    await userEvent.clear(secondAuthorInput);
    await userEvent.type(secondAuthorInput, "JaneAustenEdited");
    await userEvent.tab();
    await expect(
      within(reopenedDialog).findByDisplayValue("JaneAustenEdited"),
    ).resolves.toBeVisible();
    await userEvent.click(within(reopenedDialog).getByRole("button", { name: /update/i }));
    await waitFor(() => expect(body.queryAllByRole("dialog")).toHaveLength(0));

    await userEvent.click(editButton);
    const committedDialog = await body.findByRole("dialog");
    await expect(
      within(committedDialog).findByDisplayValue("JaneAustenEdited"),
    ).resolves.toBeVisible();

    // Editing the resource's own LabelRole value (its Title) must be reflected back on the closed
    // trigger once committed - that label comes from a react-query cache (useOptionLookups), not
    // dataGraph's own reactivity, so a commit needs to explicitly invalidate it.
    const titleInput = within(committedDialog).getByDisplayValue("Pride and Prejudice");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "PrideAndPrejudiceRevised");
    await userEvent.tab();
    await userEvent.click(within(committedDialog).getByRole("button", { name: /update/i }));
    await waitFor(() => expect(body.queryAllByRole("dialog")).toHaveLength(0));
    await expect(triggerScope.findByText("PrideAndPrejudiceRevised")).resolves.toBeVisible();
  },
};
