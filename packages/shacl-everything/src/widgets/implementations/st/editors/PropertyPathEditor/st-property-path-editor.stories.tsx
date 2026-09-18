import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:PropertyPathEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

// Fills in and saves AddPathButton/PredicatePath's shared modal (portaled to <body>, so it's
// queried there rather than within canvasElement - see PathItemModal's own comment on why) with
// the given predicate IRI, leaving the path type at its default ("predicate"), and waits for the
// modal to close again.
async function fillAndSavePathModal(predicateIri: string) {
  const body = within(document.body);
  const dialog = await body.findByRole("dialog");
  const dialogScope = within(dialog);
  await userEvent.type(dialogScope.getByRole("combobox", { name: "Predicate" }), predicateIri);
  await userEvent.click(dialogScope.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
}

// A short signature for whatever PropertyPathEditor rendered in this "sh:path value" row - used
// to tell rows apart after a removal shifts everything below it up by one slot.
function pathSignature(row: Element): string {
  const editor = row.querySelector(".st-property-path-editor");
  if (!editor) return "empty";
  for (const type of [
    "sequence",
    "alternative",
    "inverse",
    "zero-or-more",
    "one-or-more",
    "zero-or-one",
  ]) {
    if (editor.querySelector(`:scope > .st-${type}-path`)) return type;
  }
  const predicate = editor.querySelector<HTMLElement>(":scope > .st-predicate-path");
  return predicate ? `predicate:${predicate.textContent}` : "unknown";
}

// st-property-path-editor.ttl's own <#data> subject also has an sh:name/sh:description besides
// its many sh:path values, so this shape renders "Property"/"Description" fields on the same page
// alongside "Path" - scoping to the "Path" field's own container keeps a row-count assertion from
// being thrown off by those unrelated single-valued fields sharing the page.
function findPathPropertyContainer(root: ParentNode): HTMLElement {
  const label = [...root.querySelectorAll<HTMLElement>(".st-form-element__label-text")].find(
    (element) => element.textContent?.trim() === "Path",
  );
  const container = label?.closest<HTMLElement>(".st-form-element");
  if (!container) throw new Error("Could not find the 'Path' property's own container");
  return container;
}

export const stPropertyPathEditor: Story = {
  name: "An already-filled-in property path value",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
};

export const stPropertyPathEditorWrapInSequence: Story = {
  name: "Clicking + on a bare predicate wraps it in a sequence",
  args: argsByTestFile("st-property-path-editor-wrap-in-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const addButton = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(".st-add-path");
      if (!element) throw new Error("Could not find the add-path button");
      return element;
    });

    expect(canvasElement.querySelector(".st-predicate-path")?.textContent).toBe("ex:name");
    expect(canvasElement.querySelector(".st-sequence-path")).toBeNull();

    // Clicking "+" only opens the add-path modal - nothing is added to the path until a predicate
    // is entered and Save is hit, so there's no more hardcoded default predicate on click alone.
    await userEvent.click(addButton);
    await fillAndSavePathModal("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

    // The original predicate becomes item 1, the freshly entered predicate is appended as item 2.
    const items = await waitFor(() => {
      const elements = canvasElement.querySelectorAll<HTMLElement>(".st-sequence-path-item");
      if (elements.length !== 2) throw new Error("Expected a two-item sequence path");
      return elements;
    });
    expect(items[0].querySelector(".st-predicate-path")?.textContent).toBe("ex:name");
    expect(items[1].querySelector(".st-predicate-path")?.textContent).toBe("rdf:type");
  },
};

export const stPropertyPathEditorSequenceWithNestedAlternative: Story = {
  name: "A sequence item's own edits propagate through the sequence's onChange",
  args: argsByTestFile("st-property-path-editor-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // sh:path (ex:parent [sh:alternativePath (ex:father ex:mother)]) - a 2-item sequence whose
    // 2nd item is an alternative. No new buttons here: the root "+" (rendered by
    // PropertyPathEditor, next to whatever the whole path renders as) and AlternativePath's own
    // already-existing "add branch" buttons are both pre-existing controls this just wires up.
    const rootAddButton = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(
        ".st-property-path-editor > .st-add-path",
      );
      if (!element) throw new Error("Could not find the root add-path button");
      return element;
    });

    await userEvent.click(rootAddButton);
    await fillAndSavePathModal("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

    // Root is already a sequence, so the generic root "+" must append a 3rd item in place
    // rather than nesting a new outer sequence around it.
    const outerItems = await waitFor(() => {
      const elements = canvasElement.querySelectorAll<HTMLElement>(
        ".st-property-path-editor > .st-sequence-path > .st-sequence-path-items > .st-sequence-path-item",
      );
      if (elements.length !== 3) throw new Error("Expected the root sequence to grow to 3 items");
      return elements;
    });
    expect(outerItems[0].querySelector(".st-predicate-path")?.textContent).toBe("ex:parent");
    expect(outerItems[2].querySelector(".st-predicate-path")?.textContent).toBe("rdf:type");

    const alternativeAddButton = outerItems[1].querySelector<HTMLButtonElement>(
      ".st-alternative-path-add",
    );
    if (!alternativeAddButton) throw new Error("Could not find the alternative's add-branch button");

    await userEvent.click(alternativeAddButton);
    await fillAndSavePathModal("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

    // The alternative nested at index 1 grows to 3 branches - a broken per-item onChange in
    // SequencePath would drop this edit, or clobber/duplicate a sibling item instead.
    const branches = await waitFor(() => {
      const elements = outerItems[1].querySelectorAll<HTMLElement>(".st-alternative-path-branch");
      if (elements.length !== 3) throw new Error("Expected the alternative to grow to 3 branches");
      return elements;
    });
    expect(branches[0].querySelector(".st-predicate-path")?.textContent).toBe("ex:father");
    expect(branches[1].querySelector(".st-predicate-path")?.textContent).toBe("ex:mother");
    expect(branches[2].querySelector(".st-predicate-path")?.textContent).toBe("rdf:type");

    expect(outerItems[0].querySelector(".st-predicate-path")?.textContent).toBe("ex:parent");
    expect(outerItems[2].querySelector(".st-predicate-path")?.textContent).toBe("rdf:type");
  },
};

export const stPropertyPathEditorAlternativeBranchWrapInSequence: Story = {
  name: "Clicking a branch's own + wraps just that branch in a sequence",
  args: argsByTestFile("st-property-path-editor-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // sh:path (ex:parent [sh:alternativePath (ex:father ex:mother)]) - the alternative's 2
    // branches are bare predicates. Each branch's own "+" (repeated per branch, right before the
    // "|" divider) must wrap *that branch's* current path in a sequence, like the root "+" does
    // for the whole path - not insert an unrelated new branch into the alternative.
    const branches = await waitFor(() => {
      const elements = canvasElement.querySelectorAll<HTMLElement>(".st-alternative-path-branch");
      if (elements.length !== 2) throw new Error("Expected the alternative to have 2 branches");
      return elements;
    });
    expect(branches[0].querySelector(".st-predicate-path")?.textContent).toBe("ex:father");
    expect(branches[1].querySelector(".st-predicate-path")?.textContent).toBe("ex:mother");

    const firstBranchAddButton = branches[0].querySelector<HTMLButtonElement>(".st-add-path");
    if (!firstBranchAddButton) throw new Error("Could not find the first branch's own add button");

    await userEvent.click(firstBranchAddButton);
    await fillAndSavePathModal("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

    // Still exactly 2 branches (no new branch was inserted) - but branch 1 is now a 2-item
    // sequence wrapping the original predicate, and branch 2 is untouched.
    const branchesAfter = await waitFor(() => {
      const elements = canvasElement.querySelectorAll<HTMLElement>(".st-alternative-path-branch");
      if (elements.length !== 2) throw new Error("Expected the alternative to still have 2 branches");
      return elements;
    });

    const wrappedItems = await waitFor(() => {
      const elements = branchesAfter[0].querySelectorAll<HTMLElement>(".st-sequence-path-item");
      if (elements.length !== 2) throw new Error("Expected branch 1 to become a two-item sequence");
      return elements;
    });
    expect(wrappedItems[0].querySelector(".st-predicate-path")?.textContent).toBe("ex:father");
    expect(wrappedItems[1].querySelector(".st-predicate-path")?.textContent).toBe("rdf:type");

    expect(branchesAfter[1].querySelector(".st-predicate-path")?.textContent).toBe("ex:mother");
    expect(branchesAfter[1].querySelector(".st-sequence-path")).toBeNull();
  },
};

export const stPropertyPathEditorEditExistingPredicate: Story = {
  name: "Clicking an existing predicate opens the same modal, pre-filled, to edit it",
  args: argsByTestFile("st-property-path-editor-wrap-in-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const predicateBox = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(".st-predicate-path");
      if (!element) throw new Error("Could not find the predicate box");
      return element;
    });
    expect(predicateBox.textContent).toBe("ex:name");

    await userEvent.click(predicateBox);

    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    const dialogScope = within(dialog);

    // Pre-filled with the existing predicate's own full IRI, not blank - this is an edit of the
    // clicked path node, not a fresh add.
    const predicateInput = await dialogScope.findByDisplayValue("http://example.org/name");
    await userEvent.clear(predicateInput);
    await userEvent.type(predicateInput, "http://example.org/renamed");
    await userEvent.click(dialogScope.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

    expect(canvasElement.querySelector(".st-predicate-path")?.textContent).toBe("ex:renamed");
    // Still a bare predicate - editing without changing the path type doesn't wrap it in
    // anything new.
    expect(canvasElement.querySelector(".st-sequence-path")).toBeNull();
  },
};

export const stPropertyPathEditorPredicateAutocomplete: Story = {
  name: "The predicate field offers autocomplete suggestions from predicates already in use",
  args: argsByTestFile("st-property-path-editor-wrap-in-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const addButton = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(".st-add-path");
      if (!element) throw new Error("Could not find the add-path button");
      return element;
    });
    await userEvent.click(addButton);

    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    const dialogScope = within(dialog);
    const predicateField = dialogScope.getByRole("combobox", { name: "Predicate" });

    // rdfs:label is already used in this fixture's own data graph (ex:name rdfs:label "name"@en)
    // - typing part of it offers it as a suggestion without needing the full IRI typed out, and
    // free text still works regardless (see the other stories, none of which ever match a
    // suggestion). Scoped to the "already in use" group specifically (not a plain findByText)
    // since "label" is also a very live match against LOV's own real term search - asserting on
    // an actual "From LOV" result here would make this test depend on a third-party network call.
    await userEvent.type(predicateField, "label");
    const suggestion = await waitFor(() => {
      const element = dialog.querySelector<HTMLElement>('[data-group="local"]');
      if (!element) throw new Error("Could not find the 'already in use' rdfs:label suggestion");
      return element;
    });
    expect(suggestion.textContent).toContain("rdfs:label");
    await userEvent.click(suggestion);
    expect(predicateField).toHaveValue("http://www.w3.org/2000/01/rdf-schema#label");

    await userEvent.click(dialogScope.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

    const items = await waitFor(() => {
      const elements = canvasElement.querySelectorAll<HTMLElement>(".st-sequence-path-item");
      if (elements.length !== 2) throw new Error("Expected a two-item sequence path");
      return elements;
    });
    expect(items[1].querySelector(".st-predicate-path")?.textContent).toBe("rdfs:label");
  },
};

export const stPropertyPathEditorTypeSelectNotCoveredByPredicateSuggestions: Story = {
  name: "Path type stays selectable even while the predicate suggestions dropdown is open",
  args: argsByTestFile("st-property-path-editor-wrap-in-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const addButton = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(".st-add-path");
      if (!element) throw new Error("Could not find the add-path button");
      return element;
    });
    await userEvent.click(addButton);

    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    const dialogScope = within(dialog);
    const predicateField = dialogScope.getByRole("combobox", { name: "Predicate" });

    // "label" matches this fixture's own already-used rdfs:label, opening the suggestions
    // dropdown - which used to be absolutely positioned directly over the Path type field right
    // below it (see style.css's own comment on the fix), so a click meant for Path type could
    // silently land on the dropdown instead and do nothing.
    await userEvent.type(predicateField, "label");
    const dropdown = await waitFor(() => {
      const element = dialog.querySelector<HTMLElement>(".st-combo-results");
      if (!element) throw new Error("Expected the predicate suggestions dropdown to be open");
      return element;
    });

    const typeTrigger = dialogScope.getByRole("button", { name: "Path type" });
    const dropdownRect = dropdown.getBoundingClientRect();
    const triggerRect = typeTrigger.getBoundingClientRect();
    // The open dropdown must sit entirely above the Path type trigger, not overlap it.
    expect(dropdownRect.bottom).toBeLessThanOrEqual(triggerRect.top);

    // Picking a type while the dropdown is still open must actually take effect.
    await userEvent.click(typeTrigger);
    await userEvent.click(dialogScope.getByRole("option", { name: "Sequence" }));
    expect(typeTrigger).toHaveTextContent("Sequence");

    await userEvent.clear(predicateField);
    await userEvent.type(predicateField, "http://example.org/whole-new-thing");
    await userEvent.click(dialogScope.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

    expect(canvasElement.querySelector(".st-sequence-path")).not.toBeNull();
  },
};

export const stPropertyPathEditorNoRemoveAtRoot: Story = {
  name: "The edit modal has no Remove button for the root path itself",
  args: argsByTestFile("st-property-path-editor-wrap-in-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // The root path (here a single bare predicate) has no containing sequence/alternative to be
    // removed from, so PropertyPathEditor never passes PredicatePath an onRemove for it - unlike
    // an item inside a sequence/alternative (see the two stories below).
    const predicateBox = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(".st-predicate-path");
      if (!element) throw new Error("Could not find the predicate box");
      return element;
    });
    await userEvent.click(predicateBox);

    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    const dialogScope = within(dialog);
    expect(dialogScope.queryByRole("button", { name: "Remove" })).toBeNull();
  },
};

export const stPropertyPathEditorRemoveAlternativeBranch: Story = {
  name: "The edit modal's Remove button deletes that branch from its alternative",
  args: argsByTestFile("st-property-path-editor-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // sh:path (ex:parent [sh:alternativePath (ex:father ex:mother)])
    const branches = await waitFor(() => {
      const elements = canvasElement.querySelectorAll<HTMLElement>(".st-alternative-path-branch");
      if (elements.length !== 2) throw new Error("Expected the alternative to have 2 branches");
      return elements;
    });
    const motherPredicate = branches[1].querySelector<HTMLElement>(".st-predicate-path");
    if (!motherPredicate) throw new Error("Could not find the second branch's predicate box");
    expect(motherPredicate.textContent).toBe("ex:mother");

    await userEvent.click(motherPredicate);

    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    const dialogScope = within(dialog);
    await userEvent.click(dialogScope.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

    // Dropping to 1 remaining branch collapses the now-pointless alternative wrapper entirely
    // (mutation-logic's withItemRemoved) - ex:father takes its place directly as the outer
    // sequence's own 2nd item, rather than leaving a one-branch alternative behind.
    expect(canvasElement.querySelector(".st-alternative-path")).toBeNull();
    const items = await waitFor(() => {
      const elements = canvasElement.querySelectorAll<HTMLElement>(".st-sequence-path-item");
      if (elements.length !== 2) throw new Error("Expected a two-item sequence path");
      return elements;
    });
    expect(items[0].querySelector(".st-predicate-path")?.textContent).toBe("ex:parent");
    expect(items[1].querySelector(".st-predicate-path")?.textContent).toBe("ex:father");
  },
};

export const stPropertyPathEditorRemoveMiddleValue: Story = {
  name: "Removing a middle sh:path value doesn't leave a sibling showing stale content",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // st-property-path-editor.ttl gives this one PropertyShape 9 separate sh:path values (one per
    // path-type showcase), each its own PropertyPathEditor instance in the generic multi-value
    // list - rendered as sibling rows keyed by list index. Removing a middle row shifts every
    // later row's own `term` prop down by one index; PropertyPathEditor must re-derive what it
    // shows from that prop on every render, not cache it in state from whenever that particular
    // React instance/slot first mounted - otherwise a shifted-down row would keep showing its
    // *previous* neighbour's content instead of its own.
    // Waits for every row's own widget (resolved async via useWidget's Suspense) to have actually
    // rendered its path content, not just for the row wrappers themselves to exist.
    const pathContainer = await waitFor(() => findPathPropertyContainer(canvasElement));
    const rows = await waitFor(() => {
      const elements = pathContainer.querySelectorAll<HTMLElement>(".st-property-object");
      if (elements.length !== 9) throw new Error("Expected 9 sh:path value rows");
      if (elements.length !== pathContainer.querySelectorAll(".st-property-path-editor").length) {
        throw new Error("Expected every row's own widget to have finished rendering");
      }
      return elements;
    });

    const signaturesBefore = [...rows].map(pathSignature);
    const removeIndex = 2;
    const expectedAfterShift = signaturesBefore.slice(removeIndex + 1);

    const removeButton = rows[removeIndex].querySelector<HTMLButtonElement>(
      'button[aria-label="Remove value"]',
    );
    if (!removeButton) throw new Error("Could not find that row's own remove button");
    await userEvent.click(removeButton);

    const rowsAfter = await waitFor(() => {
      const elements = pathContainer.querySelectorAll<HTMLElement>(".st-property-object");
      if (elements.length !== 8) throw new Error("Expected 8 sh:path value rows to remain");
      if (elements.length !== pathContainer.querySelectorAll(".st-property-path-editor").length) {
        throw new Error("Expected every remaining row's own widget to have finished rendering");
      }
      return elements;
    });

    // Every row from the removed one onward must show what used to be its *next* sibling's
    // content, not its own stale pre-removal content.
    const signaturesAfter = [...rowsAfter].map(pathSignature);
    expect(signaturesAfter.slice(removeIndex)).toEqual(expectedAfterShift);
    // Everything above the removed row is completely untouched.
    expect(signaturesAfter.slice(0, removeIndex)).toEqual(signaturesBefore.slice(0, removeIndex));
  },
};

export const stPropertyPathEditorCreateNewValue: Story = {
  name: "Adding a brand new sh:path value doesn't crash on the still-empty term",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // The generic per-property "Add value" button (PropertyUIComponentAdd) mints a fresh, still-
    // untouched BlankNode (meta.ts's own createTerm) and mounts a brand new PropertyPathEditor
    // instance for it *before* the user has chosen a predicate - parsePathNode would throw on that
    // node directly, so this exercises the exact path a bare code-review of the add-item modal
    // flow alone wouldn't catch (see isUnsetPathNode in widget.tsx).
    // None of "Property"/"Description"/"Path" declare an sh:maxCount, so all three show their own
    // "Add value" button - scoped to the "Path" field's own container, not just the first (i.e.
    // "Property"'s) one on the whole page.
    const pathContainer = await waitFor(() => findPathPropertyContainer(canvasElement));
    const addValueButton = await waitFor(() => {
      const element = pathContainer.querySelector<HTMLButtonElement>(
        'button[aria-label="Add value"]',
      );
      if (!element) throw new Error("Could not find the Path field's own Add value button");
      return element;
    });
    await userEvent.click(addValueButton);

    const rows = await waitFor(() => {
      const elements = pathContainer.querySelectorAll<HTMLElement>(".st-property-object");
      if (elements.length !== 10) throw new Error("Expected a 10th sh:path value row to appear");
      return elements;
    });
    expect(canvasElement.querySelector('[role="alert"]')).toBeNull();

    const newRow = rows[rows.length - 1];
    const rootAddButton = newRow.querySelector<HTMLButtonElement>(
      ".st-property-path-editor > .st-add-path",
    );
    if (!rootAddButton) throw new Error("Could not find the new row's own root add-path button");
    // The new row renders no PathNode yet - just the "+" to pick the first/only path segment.
    expect(newRow.querySelector(".st-property-path-editor")?.firstElementChild).toBe(
      rootAddButton,
    );

    await userEvent.click(rootAddButton);
    await fillAndSavePathModal("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

    // The chosen predicate becomes the whole path directly - not wrapped in a one-item sequence.
    expect(newRow.querySelector(".st-predicate-path")?.textContent).toBe("rdf:type");
    expect(newRow.querySelector(".st-sequence-path")).toBeNull();
    expect(canvasElement.querySelector('[role="alert"]')).toBeNull();
  },
};

export const stPropertyPathEditorEditWrappedPredicateShowsWrapperType: Story = {
  name: "Re-opening an edit form for a wrapped predicate shows its actual wrapper type",
  args: argsByTestFile("st-property-path-editor-wrap-in-sequence.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const predicateBox = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(".st-predicate-path");
      if (!element) throw new Error("Could not find the predicate box");
      return element;
    });
    await userEvent.click(predicateBox);

    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    const dialogScope = within(dialog);
    await userEvent.click(dialogScope.getByRole("button", { name: "Path type" }));
    await userEvent.click(dialogScope.getByRole("option", { name: "Zero or more" }));
    await userEvent.click(dialogScope.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

    // Wrapped in zeroOrMore now - the icon shows it, and the predicate box is still there inside.
    expect(canvasElement.querySelector(".st-zero-or-more-path")).not.toBeNull();
    const predicateBoxAfter = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-zero-or-more-path .st-predicate-path",
      );
      if (!element) throw new Error("Could not find the predicate box after wrapping");
      return element;
    });

    // Re-opening the edit form for the same item must reflect its *actual* current type
    // (zeroOrMore) - not silently reset to "Predicate" as if the wrapper didn't exist.
    await userEvent.click(predicateBoxAfter);
    const dialog2 = await body.findByRole("dialog");
    const dialogScope2 = within(dialog2);
    expect(dialogScope2.getByRole("button", { name: "Path type" })).toHaveTextContent(
      "Zero or more",
    );

    // Switching to a different type from here must *replace* the zeroOrMore wrapper, not nest a
    // new wrapper inside it.
    await userEvent.click(dialogScope2.getByRole("button", { name: "Path type" }));
    await userEvent.click(dialogScope2.getByRole("option", { name: "Inverse" }));
    await userEvent.click(dialogScope2.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

    expect(canvasElement.querySelector(".st-zero-or-more-path")).toBeNull();
    expect(canvasElement.querySelector(".st-inverse-path")).not.toBeNull();
    expect(
      canvasElement.querySelector(".st-inverse-path .st-zero-or-more-path"),
    ).toBeNull();
  },
};
