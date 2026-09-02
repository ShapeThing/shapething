import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// Draft: Environment.readOnlyGraph is a new, not-yet-spec'd extension (no shui: term for it) -
// lives outside "SHACL 1.2 UI/" until/unless it's formalized. Existing triples also present in
// readOnlyGraph render read-only in edit mode: their shui:viewer widget instead of their
// shui:editor, with its remove button still shown but disabled (not hidden - the row's layout
// stays consistent with its editable siblings) - see PropertyUIElement.isReadOnly() and
// outputs/render/modes/edit/WidgetSlot.tsx/PropertyUIComponentRemove.tsx. Driven purely by graph
// membership - the motivating case is an embedder materializing inferred/derived triples into
// dataGraph alongside the user's own asserted ones.
export default {
  title: "Drafts/Read-only inferred values #1180",
  component: ShaclRenderer,
};

// Reuses the same schema:Product/ex:tag multi-valued fixture as
// functionality/value-order-stability.stories.tsx, plus a single-valued schema:name, so the
// per-triple (not per-property) granularity is obvious: only one of the three ex:tag values is
// read-only, while its sibling values and schema:name stay editable.
const baseArgs: ShaclRendererProps = argsByTestFile(
  "readonly-inferred-values.ttl",
  import.meta.url,
);

// readonly-inferred-values.readonly.ttl holds just the one ex:tag value a reasoner would have
// derived - everything else in the data fixture was asserted by hand and stays editable.
const readOnlyArgs: ShaclRendererProps = argsByTestFile(
  "readonly-inferred-values.ttl",
  import.meta.url,
  "readonly-inferred-values.readonly.ttl",
);

function widgetsNamed(canvasElement: HTMLElement, widgetName: string): HTMLElement[] {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>(`[data-widget="${widgetName}"]`));
}

export const allEditable: Story = {
  name: "Without readOnlyGraph, every value - including every ex:tag - is editable",
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const timeout = { timeout: 5000 };
    await canvas.findByDisplayValue("Widget", {}, timeout);
    await canvas.findByDisplayValue("Alpha", {}, timeout);
    await canvas.findByDisplayValue("Bravo", {}, timeout);
    await canvas.findByDisplayValue("Inferred", {}, timeout);

    // schema:name + all three ex:tag values (Alpha, Bravo, Inferred) all render editable.
    expect(widgetsNamed(canvasElement, "TextFieldEditor")).toHaveLength(4);
    expect(widgetsNamed(canvasElement, "LiteralViewer")).toHaveLength(0);
    expect(canvas.getAllByRole("button", { name: "Remove value" })).toHaveLength(4);
  },
};

export const oneInferredTagIsReadOnly: Story = {
  name: "With readOnlyGraph, only the one inferred ex:tag value renders read-only",
  args: readOnlyArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const timeout = { timeout: 5000 };
    await canvas.findByDisplayValue("Widget", {}, timeout);
    await canvas.findByDisplayValue("Alpha", {}, timeout);
    await canvas.findByDisplayValue("Bravo", {}, timeout);
    await canvas.findByText("Inferred", {}, timeout);

    // schema:name, "Alpha" and "Bravo" stay editable - only the inferred tag swaps to its viewer.
    expect(widgetsNamed(canvasElement, "TextFieldEditor")).toHaveLength(3);
    const [readOnlyWidget] = widgetsNamed(canvasElement, "LiteralViewer");
    expect(readOnlyWidget).toHaveTextContent("Inferred");

    // No input inside the read-only value's own row - but its remove button still renders,
    // disabled, rather than disappearing.
    const readOnlyRow = readOnlyWidget.closest(".st-property-object");
    expect(readOnlyRow?.querySelector("input")).toBeNull();
    const readOnlyRemoveButton = readOnlyRow?.querySelector('button[aria-label="Remove value"]');
    expect(readOnlyRemoveButton).not.toBeNull();
    expect(readOnlyRemoveButton).toBeDisabled();

    // Every value still gets a remove button (four total, same as the all-editable baseline) -
    // only the read-only one is disabled, the other three (schema:name, Alpha, Bravo) stay usable.
    const removeButtons = canvas.getAllByRole("button", { name: "Remove value" });
    expect(removeButtons).toHaveLength(4);
    expect(removeButtons.filter((button) => !button.hasAttribute("disabled"))).toHaveLength(3);
  },
};
