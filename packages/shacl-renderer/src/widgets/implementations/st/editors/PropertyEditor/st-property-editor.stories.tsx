import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:PropertyEditor is scored for sh:path sh:property - the properties of a node shape being
// edited. They're listed as a tree: each property under its sh:group, each group under its own
// sh:group, every level in sh:order.
export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:PropertyEditor",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, enableUndoRedo: true },
};

const args = argsByTestFile("st-property-editor.ttl", import.meta.url);

// dnd-kit measures layout between keyboard steps, so each step needs a frame to settle.
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));

// Each row as "<depth>:<label or path>", top to bottom.
const treeRows = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll(".st-property-editor__tree > li")].map((row) => {
    const body = row.querySelector<HTMLElement>(".st-property-editor__row-body")!;
    const name =
      body.querySelector(".st-property-editor__label")?.textContent ??
      body.querySelector(".st-property-editor__path")?.textContent;
    return `${body.dataset.depth}:${name}`;
  });

const initialRows = [
  "0:General",
  "1:Birth date",
  "1:Name",
  "2:Given name",
  "2:Family name",
  "0:Email",
  "0:schema:telephone",
];

const unusedGroups = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll(".st-property-editor__unused-group")].map(
    (group) => group.querySelector(".st-property-editor__label")?.textContent,
  );

// The aria-labels interpolate the row's name, which Fluent wraps in Unicode isolation marks - hence
// the optional non-word characters around it in the name matchers below.
const handleOf = (canvasElement: HTMLElement, name: string) => {
  const row = [...canvasElement.querySelectorAll<HTMLElement>(".st-property-editor__tree > li")].find(
    (row) => row.querySelector(".st-property-editor__row-body")?.textContent?.includes(name),
  );
  if (!row) throw new Error(`No row for ${name}`);
  return within(row).getByRole("button", { name: "Reorder item" });
};

export const stPropertyEditor: Story = {
  name: "Properties nested in their groups, with the unused groups below",
  args,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));
    expect(unusedGroups(canvasElement)).toEqual(["Death"]);
    // Rows have their own remove buttons; the property-level "-" (clearing every property) is hidden.
    // Scoped to the Properties field - the shape's own Name value keeps its "-".
    const field = canvasElement.querySelector<HTMLElement>(".st-property-editor")!.closest<HTMLElement>(
      ".st-property-object",
    )!;
    expect(within(field).queryByRole("button", { name: "Remove value" })).toBeNull();
  },
};

export const stPropertyEditorKeyboardReorder: Story = {
  name: "Dragging a property between a group's properties moves it into that group",
  args,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));

    // Email, one slot up: between Given name and Family name, so inside the Name group.
    handleOf(canvasElement, "Email").focus();
    await userEvent.keyboard(" ");
    await nextFrame();
    await userEvent.keyboard("{ArrowUp}");
    await nextFrame();
    await userEvent.keyboard(" ");

    await waitFor(() =>
      expect(treeRows(canvasElement)).toEqual([
        "0:General",
        "1:Birth date",
        "1:Name",
        "2:Given name",
        "2:Email",
        "2:Family name",
        "0:schema:telephone",
      ]),
    );

    // sh:group and the renumbered sh:order are one write, so one undo puts it all back.
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));
  },
};

// A real mouse drag: dnd-kit's MouseSensor reads mousedown on the handle, then mousemove/mouseup
// on the document. The target is measured only once the drag has started (starting it can shift
// the layout), and moved onto twice: dnd-kit measures its droppables after activation, so a single
// move can still be tested against stale or missing rects and miss the target.
async function mouseDrag(source: HTMLElement, target: HTMLElement) {
  const from = source.getBoundingClientRect();
  const at = (rect: DOMRect, dy = 0) => ({
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2 + dy,
    bubbles: true,
    button: 0,
  });
  source.dispatchEvent(new MouseEvent("mousedown", at(from)));
  await nextFrame();
  document.dispatchEvent(new MouseEvent("mousemove", at(from, 5)));
  await nextFrame();
  await nextFrame();
  document.dispatchEvent(new MouseEvent("mousemove", at(target.getBoundingClientRect())));
  await nextFrame();
  const to = target.getBoundingClientRect();
  document.dispatchEvent(new MouseEvent("mousemove", at(to, 1)));
  await nextFrame();
  document.dispatchEvent(new MouseEvent("mouseup", at(to, 1)));
  await nextFrame();
}

export const stPropertyEditorDropOnUnusedGroup: Story = {
  name: "Dropping a property on an unused group starts using that group",
  args,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));
    const death = canvasElement.querySelector<HTMLElement>(".st-property-editor__unused-group")!;

    await mouseDrag(handleOf(canvasElement, "schema:telephone"), death);

    await waitFor(() =>
      expect(treeRows(canvasElement)).toEqual([
        "0:General",
        "1:Birth date",
        "1:Name",
        "2:Given name",
        "2:Family name",
        "0:Email",
        "0:Death",
        "1:schema:telephone",
      ]),
    );
    expect(unusedGroups(canvasElement)).toEqual([]);
  },
};

export const stPropertyEditorAddProperty: Story = {
  name: "Adding a property through the modal",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));

    await userEvent.click(canvas.getByRole("button", { name: "Add a property" }));
    const dialog = await within(document.body).findByRole("dialog");
    expect(dialog).toHaveTextContent("New property");
    const [name] = await within(dialog).findAllByRole("textbox");
    await userEvent.type(name, "Nickname");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // Linked in last, after the properties already there.
    await waitFor(() => expect(treeRows(canvasElement)).toEqual([...initialRows, "0:Nickname"]));
    expect(document.querySelector("dialog[open]")).toBeNull();
  },
};

export const stPropertyEditorEditProperty: Story = {
  name: "Editing a property through the modal",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));

    await userEvent.click(canvas.getByRole("button", { name: /^Edit \W?Email\W?$/ }));
    const dialog = await within(document.body).findByRole("dialog");
    const [name] = await within(dialog).findAllByRole("textbox");
    await waitFor(() => expect(name).toHaveValue("Email"));
    await userEvent.clear(name);
    await userEvent.type(name, "Email address");
    await userEvent.click(within(dialog).getByRole("button", { name: "Update" }));

    await waitFor(() => expect(treeRows(canvasElement)).toContain("0:Email address"));
  },
};

export const stPropertyEditorRemoveProperty: Story = {
  name: "Removing a property",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));

    await userEvent.click(canvas.getByRole("button", { name: /^Edit \W?schema:telephone\W?$/ }));
    const dialog = await within(document.body).findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove property" }));
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows.slice(0, -1)));
  },
};

export const stPropertyEditorCancel: Story = {
  name: "Cancelling a property's modal, which asks first once something changed",
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));

    // Untouched: closes straight away.
    await userEvent.click(canvas.getByRole("button", { name: /^Edit \W?Email\W?$/ }));
    let dialog = await within(document.body).findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.querySelector("dialog[open]")).toBeNull());

    // Edited: asks before discarding, and nothing is written.
    await userEvent.click(canvas.getByRole("button", { name: /^Edit \W?Email\W?$/ }));
    dialog = await within(document.body).findByRole("dialog");
    const [name] = await within(dialog).findAllByRole("textbox");
    await waitFor(() => expect(name).toHaveValue("Email"));
    await userEvent.type(name, " address");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    const confirm = await within(document.body).findByRole("dialog", { name: "Discard changes?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(document.querySelector("dialog[open]")).toBeNull());
    expect(treeRows(canvasElement)).toEqual(initialRows);
  },
};

// The same node shape, edited with meta/shape.ttl - whose <#propertyGroup> is what a group opens
// with, and what makes "Add a group" available.
const metaArgs = {
  ...args,
  shapesGraph: fixtureUrl("../../../../../stories/meta/shape.ttl", import.meta.url),
  nodeShapes: [
    factory.namedNode(
      fixtureUrl("../../../../../stories/meta/shape.ttl#nodeShape", import.meta.url).href,
    ),
  ],
};

export const stPropertyEditorMetaShapeGroups: Story = {
  name: "Editing and adding groups with the meta shape",
  args: metaArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows), { timeout: 15000 });

    // An existing group opens with its name filled in.
    await userEvent.click(canvas.getByRole("button", { name: /^Edit \W?General\W?$/ }));
    let dialog = await within(document.body).findByRole("dialog");
    const [name] = await within(dialog).findAllByRole("textbox");
    await waitFor(() => expect(name).toHaveValue("General"));
    await userEvent.clear(name);
    await userEvent.type(name, "Personal");
    await userEvent.click(within(dialog).getByRole("button", { name: "Update" }));
    await waitFor(() => expect(treeRows(canvasElement)[0]).toBe("0:Personal"));

    // A new group isn't used by anything yet - it joins the unused groups, first since it has no
    // sh:order (counting as 0) and Death has 4.
    await userEvent.click(canvas.getByRole("button", { name: "Add a group" }));
    dialog = await within(document.body).findByRole("dialog");
    expect(dialog).toHaveTextContent("New group");
    const [newName] = await within(dialog).findAllByRole("textbox");
    await userEvent.type(newName, "Contact");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(unusedGroups(canvasElement)).toEqual(["Contact", "Death"]));
  },
};

export const stPropertyEditorDeleteGroup: Story = {
  name: "Deleting a group, which names the other shapes using it",
  args: metaArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows), { timeout: 15000 });

    await userEvent.click(canvas.getByRole("button", { name: /^Edit \W?Name\W?$/ }));
    const draft = await within(document.body).findByRole("dialog");
    await userEvent.click(within(draft).getByRole("button", { name: "Delete group" }));
    const dialog = await within(document.body).findByRole("dialog", { name: "Delete group?" });
    expect(dialog).toHaveTextContent("Delete group?");
    expect(within(dialog).getByRole("listitem")).toHaveTextContent("Contact card");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    // Gone, and what was in it is no longer in a group.
    await waitFor(() => {
      const rows = treeRows(canvasElement);
      expect(rows).not.toContain("1:Name");
      expect(rows).toContain("0:Given name");
      expect(rows).toContain("0:Family name");
    });
    expect(document.querySelector("dialog[open]")).toBeNull();

    // One undo step brings the group and its sh:group statements back.
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(treeRows(canvasElement)).toEqual(initialRows));
  },
};

export const stPropertyEditorDeleteUnusedGroup: Story = {
  name: "Deleting an unused group, used by no other shape",
  args: metaArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(unusedGroups(canvasElement)).toEqual(["Death"]), { timeout: 15000 });

    await userEvent.click(canvas.getByRole("button", { name: /^Edit \W?Death\W?$/ }));
    const draft = await within(document.body).findByRole("dialog");
    await userEvent.click(within(draft).getByRole("button", { name: "Delete group" }));
    const dialog = await within(document.body).findByRole("dialog", { name: "Delete group?" });
    expect(within(dialog).queryByRole("list")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(unusedGroups(canvasElement)).toEqual([]));
  },
};
