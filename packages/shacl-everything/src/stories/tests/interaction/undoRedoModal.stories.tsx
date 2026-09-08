import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { ex } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/Undo and redo inside a modal",
  component: ShaclRenderer,
};

let submittedResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submittedResult = result;
};

const args: ShaclRendererProps = {
  ...argsByTestFile("../../showcases/recipes-and-chefs.ttl", import.meta.url),
  nodeShapes: [ex("RecipeShape")],
  enableLinksToResources: false,
  enableUndoRedo: true,
  onSubmit,
};

function findFieldInput(container: HTMLElement, labelText: string): HTMLInputElement {
  const label = [...container.querySelectorAll(".st-form-element__label")].find((el) =>
    el.textContent?.includes(labelText),
  );
  if (!label) throw new Error(`Could not find a field labelled "${labelText}"`);
  const formElement = label.closest(".st-form-element")!;
  const input = formElement.querySelector<HTMLInputElement>('input[type="text"]');
  if (!input) throw new Error(`Field "${labelText}" has no text input`);
  return input;
}

export const modalUndoOnlyAffectsItsOwnStagingGraph: Story = {
  name: "Ctrl+Z inside a resource edit-in-place modal only undoes that modal's own graph",
  args,
  play: async ({ canvasElement }) => {
    submittedResult = undefined;

    // Edit the outer Recipe's own Cuisine field first, so the outer form's undo stack has
    // something real on it to protect.
    const cuisineInput = await waitFor(() => findFieldInput(canvasElement, "Cuisine"), {
      timeout: 5000,
    });
    await userEvent.clear(cuisineInput);
    await userEvent.type(cuisineInput, "Test cuisine");
    await userEvent.tab();
    await waitFor(() => expect(cuisineInput).toHaveValue("Test cuisine"));

    // Open the Chef field's edit-in-place modal (AutoCompleteOption's own resourceEditor,
    // staged against a separate makeReactive() store - see AutoCompleteOption/index.tsx).
    const editButton = await waitFor(
      () => {
        const element = canvasElement.querySelector<HTMLElement>(".st-autocomplete-option__edit");
        if (!element) throw new Error("Could not find the Chef field's edit-in-place button");
        return element;
      },
      { timeout: 5000 },
    );
    await userEvent.click(editButton);

    const dialog = await waitFor(
      () => {
        const element = canvasElement.querySelector<HTMLDialogElement>("dialog.st-modal[open]");
        if (!element) throw new Error("The Chef edit-in-place modal did not open");
        return element;
      },
      { timeout: 5000 },
    );

    // Edit the chef's Nationality inside the modal - this writes to the modal's own staging
    // graph, never the outer form's live dataGraph, until "Update" is clicked (not done here).
    const nationalityInput = await waitFor(() => findFieldInput(dialog, "Nationality"), {
      timeout: 5000,
    });
    expect(nationalityInput).toHaveValue("British");
    await userEvent.clear(nationalityInput);
    await userEvent.type(nationalityInput, "Scottish");
    await userEvent.tab();
    await waitFor(() => expect(nationalityInput).toHaveValue("Scottish"));

    const modalSubmitButton = dialog.querySelector<HTMLButtonElement>(
      ".st-autocomplete-option__resource-form-actions button",
    )!;
    modalSubmitButton.focus();

    // One Ctrl+Z, still focused inside the modal, must undo the modal's own edit - not fall
    // through to (or otherwise disturb) the outer Cuisine edit sitting underneath it.
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(nationalityInput).toHaveValue("British"));
    expect(cuisineInput).toHaveValue("Test cuisine");

    // A second Ctrl+Z, with the modal's own stack now empty, must be a no-op here too - not leak
    // through to the outer form's stack and undo the Cuisine edit out from under the still-open
    // modal.
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(nationalityInput).toHaveValue("British");
    expect(cuisineInput).toHaveValue("Test cuisine");

    // Close the modal (nothing left staged to confirm discarding, since it's back to the original
    // value) and confirm the outer form's own undo still works normally afterwards.
    const closeButton = dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!;
    await userEvent.click(closeButton);
    await waitFor(() => expect(canvasElement.querySelector("dialog.st-modal[open]")).toBeNull());

    const submitButton = canvasElement.querySelector('button[type="submit"]')!;
    (submitButton as HTMLButtonElement).focus();
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(cuisineInput).toHaveValue("British"));

    await userEvent.click(submitButton);
    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });
    // The whole in-modal detour must have left the outer dataGraph exactly as it started.
    expect(result.additions).toEqual([]);
    expect(result.deletions).toEqual([]);
  },
};
