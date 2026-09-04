import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "SHACL 1.2 UI/10. Built-in Widgets/10.1 Editors/10.1.2 shui:BlankNodeEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const shuiBlankNodeEditor: Story = {
  name: "Read-only display of a blank node value",
  args: argsByTestFile("10.1.2 shui-blank-node-editor.ttl", import.meta.url),
};

export const shuiBlankNodeEditorAssignIdentifier: Story = {
  name: "Assigning an identifier hands off to IRIEditor",
  args: argsByTestFile("10.1.2b shui-blank-node-editor-assign-identifier.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const assignButton = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLButtonElement>(
        ".st-blank-node-editor__assign",
      );
      if (!element) throw new Error("Could not find the BlankNodeEditor assign button");
      return element;
    });

    await userEvent.click(assignButton);

    // Rescoring the now-NamedNode value must swap the mounted widget from BlankNodeEditor to
    // IRIEditor in place - not just resolve a new winner internally while the stale widget (and
    // its now-meaningless "assign an identifier" button) stays on screen.
    const iriWidget = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>('[data-widget="IRIEditor"]');
      if (!element) throw new Error("IRIEditor did not take over after assigning an identifier");
      return element;
    });
    expect(canvasElement.querySelector(".st-blank-node-editor__assign")).toBeNull();

    // The assigned identifier is a freshly generated, non-empty urn:uuid: - never the empty
    // string, which rdf-stores' own dictionary would otherwise round-trip back as DefaultGraph
    // rather than the NamedNode this widget actually assigned.
    const iriInput = within(iriWidget).getByRole("textbox") as HTMLInputElement;
    expect(iriInput.value).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);

    // The handed-off IRIEditor must be a real, live widget - not a dead husk - so typing into it
    // and committing on blur has to actually write the identifier back to the data graph.
    await userEvent.clear(iriInput);
    await userEvent.type(iriInput, "https://example.com/hendrik/address");
    await userEvent.tab();
    await expect(iriInput).toHaveValue("https://example.com/hendrik/address");
  },
};
