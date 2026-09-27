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

export const stPropertyPathEditor: Story = {
  name: "An already-filled-in property path value",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
};

export const stPropertyPathEditorAddPredicate: Story = {
  name: "Adding a step through the predicate modal",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    // The value that is a plain predicate (rdfs:label) - its add buttons sit right around it.
    const predicate = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-property-path-editor > .st-predicate-path",
      );
      if (!element) throw new Error("Could not find a plain predicate path");
      return element;
    });
    const editor = predicate.parentElement as HTMLElement;

    predicate.focus();
    const addAfter = predicate.nextElementSibling as HTMLElement;
    await userEvent.click(addAfter);

    const dialog = await within(canvasElement).findByRole("dialog");
    const input = within(dialog).getByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, "http://example.org/newStep");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // rdfs:label is now wrapped in a sequence with the new step after it.
    await waitFor(() => {
      const sequence = editor.querySelector(":scope > .st-sequence-path");
      expect(sequence).not.toBeNull();
      expect(sequence?.textContent).toContain("newStep");
    });
    expect(canvasElement.querySelector("dialog[open]")).toBeNull();
  },
};

export const stPropertyPathEditorAlternativeTabOrder: Story = {
  name: "Tabbing through an alternative path follows its visual order",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const alternative = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-property-path-editor > .st-alternative-path",
      );
      if (!element) throw new Error("Could not find a top-level alternative path");
      return element;
    });
    const prefix = alternative.querySelector<HTMLElement>(":scope > .st-alternative-path-prefix")!;
    const suffix = alternative.querySelector<HTMLElement>(":scope > .st-alternative-path-suffix")!;
    const appendBranch = alternative.querySelector<HTMLElement>(":scope > .st-add-button")!;
    const items = [...alternative.querySelectorAll(".st-alternative-path-item")];

    // Prefix, then each branch left to right (add, predicate, add), then the append-branch
    // button at the bottom, then the suffix.
    const expected = [
      prefix,
      ...items.flatMap((item) => [...item.children] as HTMLElement[]),
      appendBranch,
      suffix,
    ];

    prefix.focus();
    for (const element of expected.slice(1)) {
      await userEvent.tab();
      expect(element).toHaveFocus();
    }
  },
};

export const stPropertyPathEditorChangeType: Story = {
  name: "Changing a path's type through the prefix's context menu",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const alternative = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-property-path-editor > .st-alternative-path",
      );
      if (!element) throw new Error("Could not find a top-level alternative path");
      return element;
    });
    const editor = alternative.parentElement as HTMLElement;
    const prefix = alternative.querySelector<HTMLElement>(":scope > .st-alternative-path-prefix")!;

    // Press and release: the menu must survive the release, which lands outside it.
    await userEvent.pointer([{ keys: "[MouseRight]", target: prefix }]);
    const menu = await within(canvasElement).findByRole("menu");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(menu).toBeVisible();
    // The menu has focus, but the prefix it opened from keeps its focus outline.
    expect(prefix).toHaveAttribute("data-type-menu-open");

    // Every type is listed; a list has no single predicate to become.
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(7);
    expect(within(menu).getByRole("menuitemradio", { name: "Predicate" })).toBeDisabled();
    expect(within(menu).getByRole("menuitemradio", { name: "Alternative" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await userEvent.click(within(menu).getByRole("menuitemradio", { name: "Sequence" }));

    await waitFor(() => {
      const sequence = editor.querySelector(":scope > .st-sequence-path");
      expect(sequence).not.toBeNull();
      expect(sequence?.textContent).toContain("father");
      expect(sequence?.textContent).toContain("mother");
    });
    expect(editor.querySelector(":scope > .st-alternative-path")).toBeNull();
    expect(within(canvasElement).queryByRole("menu")).toBeNull();
  },
};

// Opens the context menu on `target` the way a right-click does.
async function openContextMenu(canvasElement: HTMLElement, target: HTMLElement) {
  await userEvent.pointer([{ keys: "[MouseRight]", target }]);
  return within(canvasElement).findByRole("menu");
}

export const stPropertyPathEditorWrapPredicate: Story = {
  name: "Wrapping a predicate through its context menu",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const predicate = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-property-path-editor > .st-predicate-path",
      );
      if (!element) throw new Error("Could not find a plain predicate path");
      return element;
    });
    const editor = predicate.parentElement as HTMLElement;

    const menu = await openContextMenu(canvasElement, predicate);
    await userEvent.click(within(menu).getByRole("menuitemradio", { name: "Inverse" }));

    const inverse = await waitFor(() => {
      const element = editor.querySelector<HTMLElement>(":scope > .st-inverse-path");
      if (!element) throw new Error("The predicate was not wrapped in an inverse path");
      return element;
    });
    expect(inverse.querySelector(".st-predicate-path")?.textContent).toContain("label");

    // And back: a wrapper around a predicate can unwrap to it.
    const prefix = inverse.querySelector<HTMLElement>(":scope > .st-inverse-path-prefix")!;
    const unwrapMenu = await openContextMenu(canvasElement, prefix);
    await userEvent.click(within(unwrapMenu).getByRole("menuitemradio", { name: "Predicate" }));
    const unwrapped = await waitFor(() => {
      const element = editor.querySelector<HTMLElement>(":scope > .st-predicate-path");
      if (!element) throw new Error("The inverse path was not unwrapped");
      return element;
    });

    // To a sequence: a one-item sequence isn't valid, so the modal asks for the next step.
    const sequenceMenu = await openContextMenu(canvasElement, unwrapped);
    await userEvent.click(within(sequenceMenu).getByRole("menuitemradio", { name: "Sequence" }));
    const dialog = await within(canvasElement).findByRole("dialog");
    const input = within(dialog).getByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, "http://example.org/nextStep");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const sequence = editor.querySelector(":scope > .st-sequence-path");
      expect(sequence?.textContent).toMatch(/label.*nextStep/);
    });
  },
};

export const stPropertyPathEditorWrapList: Story = {
  name: "Switching a list to a wrapper type wraps the whole list",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const alternative = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-property-path-editor > .st-alternative-path",
      );
      if (!element) throw new Error("Could not find a top-level alternative path");
      return element;
    });
    const editor = alternative.parentElement as HTMLElement;
    const prefix = alternative.querySelector<HTMLElement>(":scope > .st-alternative-path-prefix")!;

    const menu = await openContextMenu(canvasElement, prefix);
    await userEvent.click(within(menu).getByRole("menuitemradio", { name: "Zero or more" }));

    // (father | mother) becomes (father | mother)*.
    await waitFor(() => {
      const wrapper = editor.querySelector(":scope > .st-zero-or-more-path");
      expect(wrapper?.querySelector(":scope > .st-alternative-path")).not.toBeNull();
    });
  },
};

export const stPropertyPathEditorRemove: Story = {
  name: "Removing a branch collapses a two-branch alternative",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const alternative = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-property-path-editor > .st-alternative-path",
      );
      if (!element) throw new Error("Could not find a top-level alternative path");
      return element;
    });
    const editor = alternative.parentElement as HTMLElement;
    const [father] = alternative.querySelectorAll<HTMLElement>(".st-predicate-path");

    const menu = await openContextMenu(canvasElement, father);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Remove" }));

    // ex:father | ex:mother minus ex:father leaves just ex:mother.
    await waitFor(() => {
      expect(editor.querySelector(":scope > .st-alternative-path")).toBeNull();
      const predicate = editor.querySelector(":scope > .st-predicate-path");
      expect(predicate?.textContent).toContain("mother");
    });
  },
};

export const stPropertyPathEditorEditPredicate: Story = {
  name: "Editing a predicate through its context menu",
  args: argsByTestFile("st-property-path-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const predicate = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>(
        ".st-property-path-editor > .st-predicate-path",
      );
      if (!element) throw new Error("Could not find a plain predicate path");
      return element;
    });
    const editor = predicate.parentElement as HTMLElement;

    // Containers have nothing to edit in place.
    const alternativePrefix = canvasElement.querySelector<HTMLElement>(
      ".st-property-path-editor > .st-alternative-path > .st-alternative-path-prefix",
    )!;
    const containerMenu = await openContextMenu(canvasElement, alternativePrefix);
    expect(within(containerMenu).getByRole("menuitem", { name: "Edit" })).toBeDisabled();
    // Focus moves into the menu (onto the current type), so the keyboard works there.
    await waitFor(() =>
      expect(
        within(containerMenu).getByRole("menuitemradio", { name: "Alternative" }),
      ).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
    expect(alternativePrefix).toHaveFocus();
    await waitFor(() => expect(within(canvasElement).queryByRole("menu")).toBeNull());

    const menu = await openContextMenu(canvasElement, predicate);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));

    const dialog = await within(canvasElement).findByRole("dialog");
    expect(dialog).toHaveTextContent("Edit path item");
    const input = within(dialog).getByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    expect((input as HTMLInputElement).value).not.toBe("");

    await userEvent.clear(input);
    await userEvent.type(input, "http://example.org/renamed");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // Replaced in place: still a plain predicate, not wrapped in a sequence.
    await waitFor(() => {
      expect(editor.querySelector(":scope > .st-sequence-path")).toBeNull();
      const predicates = [...editor.querySelectorAll(":scope > .st-predicate-path")];
      expect(predicates.some((element) => element.textContent?.includes("renamed"))).toBe(true);
      expect(predicates.some((element) => element.textContent?.includes("label"))).toBe(false);
    });
  },
};
