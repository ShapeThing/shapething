import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Tests/Interaction/Undo and redo",
  component: ShaclRenderer,
};

// Same reasoning as submit.stories.tsx's own onSubmit: a plain closure, not fn(), so Storybook
// never tries to serialise a raw RdfStore (a real internal cycle) for the Actions panel.
let submittedResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submittedResult = result;
};

// enableUndoRedo already defaults to true (see defaultEnvironment), but is spelled out here since
// it's the whole point of this fixture.
const textFieldArgs: ShaclRendererProps = {
  ...argsByTestFile("undoRedo.ttl", import.meta.url),
  enableUndoRedo: true,
  onSubmit,
};

export const undoRedoRevertsACommittedFieldEdit: Story = {
  name: "Ctrl+Z reverts a committed field edit, Ctrl+Y redoes it",
  args: textFieldArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    submittedResult = undefined;

    const input = await canvas.findByRole("textbox");
    expect(input).toHaveValue("Hendrik");

    // TextFieldEditor only commits to dataGraph on blur (useDeferredInput) - tabbing away moves
    // focus to the submit button, which isn't a text input, so the undo/redo listener isn't
    // suppressed by the editable-target carve-out for the next step.
    await userEvent.clear(input);
    await userEvent.type(input, "Klaas");
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveValue("Klaas"));

    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(input).toHaveValue("Hendrik"));

    await userEvent.keyboard("{Control>}y{/Control}");
    await waitFor(() => expect(input).toHaveValue("Klaas"));

    // Undo once more, then submit - the graph must be exactly back to its original state.
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(input).toHaveValue("Hendrik"));

    const submitButton = await canvas.findByRole("button", { name: "Update" });
    await userEvent.click(submitButton);
    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });
    expect(result.additions).toEqual([]);
    expect(result.deletions).toEqual([]);
  },
};

export const undoRedoIgnoredWhileTypingInAField: Story = {
  name: "Ctrl+Z inside a focused text field doesn't disturb an in-progress edit",
  args: textFieldArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole("textbox");
    expect(input).toHaveValue("Hendrik");

    // A first committed edit, so there's something real sitting on the undo stack below.
    await userEvent.clear(input);
    await userEvent.type(input, "Klaas");
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveValue("Klaas"));

    // Re-focus and start a second, not-yet-committed edit (useDeferredInput only calls setTerm on
    // blur), then press Ctrl+Z while still focused inside the field.
    await userEvent.click(input);
    await userEvent.type(input, " Jr");

    await userEvent.keyboard("{Control>}z{/Control}");
    // If the editable-target carve-out didn't apply, this would have undone the *previous*
    // commit straight through dataGraph's reactivity, snapping the field back to "Hendrik" out
    // from under the user's still-in-progress typing - it must instead be untouched.
    expect(input).toHaveValue("Klaas Jr");

    await userEvent.tab();
    await waitFor(() => expect(input).toHaveValue("Klaas Jr"));

    // Focus has moved off the field now, so this Ctrl+Z is free to undo - and it must still see
    // "Klaas" as the step right before "Klaas Jr", proving the earlier keypress-while-focused was
    // genuinely a no-op rather than corrupting or consuming a stack entry.
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(input).toHaveValue("Klaas"));
  },
};

const removeArgs: ShaclRendererProps = {
  ...argsByTestFile("undoRedoRemove.ttl", import.meta.url),
  enableUndoRedo: true,
  onSubmit,
};

export const undoRestoringARemovedValueLeavesNoStrayEmptyField: Story = {
  name: "Ctrl+Z restoring a removed value doesn't leave a stray empty field behind",
  args: removeArgs,
  play: async ({ canvasElement }) => {
    submittedResult = undefined;
    const canvas = within(canvasElement);
    await canvas.findByRole("textbox");

    // PropertyUIComponentValues tracks whether to show a trailing empty "add another" widget as
    // its own local state (showEmptyWidget), synced via this property's onRemove/onTermSet
    // callbacks - which only fire for actions the widget itself makes. Clicking "-" fires onRemove
    // (correctly opening an empty placeholder, since the property is now empty); undoing that
    // removal instead restores the value by writing straight to dataGraph (see
    // helpers/reactiveRdfStore.ts's History), bypassing that callback entirely - so
    // PropertyUIComponentValues must resync from the data itself, or the restored value renders
    // alongside a leftover empty field nothing ever closes.
    const removeButton = canvasElement.querySelector<HTMLButtonElement>(
      ".st-property-object-wrapper button",
    )!;
    await userEvent.click(removeButton);
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('input[type="text"]').length).toBe(1),
    );

    const submitButton = await canvas.findByRole("button", { name: "Update" });
    (submitButton as HTMLButtonElement).focus();
    await userEvent.keyboard("{Control>}z{/Control}");

    await waitFor(() => {
      const inputs = [...canvasElement.querySelectorAll('input[type="text"]')];
      expect(inputs.map((el) => (el as HTMLInputElement).value)).toEqual([
        "https://example.com/existing.jpg",
      ]);
    });

    await userEvent.click(submitButton);
    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });
    expect(result.additions).toEqual([]);
    expect(result.deletions).toEqual([]);
  },
};

const memberShapeListArgs: ShaclRendererProps = {
  ...argsByTestFile("undoRedoMemberShapeList.ttl", import.meta.url),
  enableUndoRedo: true,
  onSubmit,
};

function memberShapeListItems(canvasElement: HTMLElement): HTMLElement[] {
  return [...canvasElement.querySelectorAll<HTMLElement>(".st-member-shape-list__item")];
}

export const undoRestoringARemovedListItemLeavesTheRestIntact: Story = {
  name: "Ctrl+Z after removing one rdf:List item restores the whole list, not just that item",
  args: memberShapeListArgs,
  play: async ({ canvasElement }) => {
    submittedResult = undefined;

    // MemberShapeList.commit() rebuilds the whole rdf:List skeleton (rebuildRdfList) and then
    // separately swaps the property's own value to the fresh head - many addQuad/removeQuad calls
    // for a single "remove one item" gesture, all wrapped in one transaction() (see
    // outputs/render/modes/edit/MemberShapeList.tsx) so Ctrl+Z can't land mid-rebuild.
    await waitFor(() => expect(memberShapeListItems(canvasElement).length).toBe(3));

    const secondItem = memberShapeListItems(canvasElement)[1];
    const removeButton = secondItem.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove item"]',
    )!;
    await userEvent.click(removeButton);
    await waitFor(() => expect(memberShapeListItems(canvasElement).length).toBe(2));

    const submitButton = canvasElement.querySelector('button[type="submit"]')!;
    (submitButton as HTMLButtonElement).focus();
    await userEvent.keyboard("{Control>}z{/Control}");

    await waitFor(() => {
      const names = memberShapeListItems(canvasElement).map(
        (item) => item.querySelector<HTMLInputElement>('input[type="text"]')?.value,
      );
      expect(names).toEqual(["First", "Second", "Third"]);
    });

    await userEvent.click(submitButton);
    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });
    expect(result.additions).toEqual([]);
    expect(result.deletions).toEqual([]);
  },
};

const blankNodeArgs: ShaclRendererProps = {
  ...argsByTestFile("undoRedoBlankNode.ttl", import.meta.url),
  enableUndoRedo: true,
  onSubmit,
};

export const undoRevertsAWholeMultiQuadGestureAsOneStep: Story = {
  name: "Ctrl+Z reverts a multi-quad widget gesture (BlankNodeEditor) as one step",
  args: blankNodeArgs,
  play: async ({ canvasElement }) => {
    submittedResult = undefined;

    // Assigning an identifier (BlankNodeEditor.changeIdentity) both retargets the blank node's own
    // schema:postalCode quad onto the new IRI and rewrites the schema:address link itself - four
    // addQuad/removeQuad calls total, wrapped in one transaction() (see widget.tsx).
    const assignButton = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(
        ".st-blank-node-editor__assign",
      );
      if (!element) throw new Error("Could not find the BlankNodeEditor assign button");
      return element;
    });
    await userEvent.click(assignButton);

    await waitFor(() => {
      if (!canvasElement.querySelector('[data-widget="IRIEditor"]')) {
        throw new Error("IRIEditor did not take over after assigning an identifier");
      }
    });

    // One Ctrl+Z must undo the whole gesture - not just the last quad written - so the widget
    // fully swaps back to BlankNodeEditor rather than getting stuck half-migrated.
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => {
      if (!canvasElement.querySelector(".st-blank-node-editor__assign")) {
        throw new Error("BlankNodeEditor did not come back after undo");
      }
    });

    // Submitting now must report no changes at all - if only the top-level schema:address link
    // had been reverted while schema:postalCode stayed stranded on the discarded IRI, this diff
    // would be non-empty.
    const canvas = within(canvasElement);
    const submitButton = await canvas.findByRole("button", { name: "Update" });
    await userEvent.click(submitButton);
    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });
    expect(result.additions).toEqual([]);
    expect(result.deletions).toEqual([]);
  },
};
