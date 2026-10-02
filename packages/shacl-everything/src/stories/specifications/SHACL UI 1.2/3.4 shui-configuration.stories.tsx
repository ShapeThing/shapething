import type { StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import type { SubmitResult } from "@/environment.ts";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// shui:languagePreference and shui:labelPreference are covered by resolution/label.test.ts and
// resolution/globalConfiguration.test.ts; shui:defaultNamespace by helpers/freshIri.test.ts.
export default {
  title: "Specifications/SHACL UI 1.2/3. Configuration/3.4 SHACL Global Configuration",
  component: ShaclRenderer,
};

function widgetsNamed(canvasElement: HTMLElement, widgetName: string): HTMLElement[] {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>(`[data-widget="${widgetName}"]`));
}

export const readOnlyGraph: Story = {
  name: "shui:readOnlyGraph: triples in a listed named graph render read-only",
  args: argsByTestFile("3.4.a shui-read-only-graph.trig", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const timeout = { timeout: 5000 };
    await canvas.findByDisplayValue("Widget", {}, timeout);
    await canvas.findByDisplayValue("Alpha", {}, timeout);
    await canvas.findByDisplayValue("Bravo", {}, timeout);
    await canvas.findByText("Inferred", {}, timeout);

    // Only the tag from the <#inferred> graph swaps to its viewer, with its remove button disabled.
    expect(widgetsNamed(canvasElement, "TextFieldEditor")).toHaveLength(3);
    const [readOnlyWidget] = widgetsNamed(canvasElement, "LiteralViewer");
    expect(readOnlyWidget).toHaveTextContent("Inferred");
    const readOnlyRow = readOnlyWidget.closest(".st-property-object");
    expect(readOnlyRow?.querySelector("input")).toBeNull();
    expect(readOnlyRow?.querySelector('button[aria-label="Remove value"]')).toBeDisabled();
  },
};

let submittedResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submittedResult = result;
};

export const timeZone: Story = {
  name: "shui:timeZone: date-times are shown and written in the configured zone",
  args: { ...argsByTestFile("3.4.b shui-time-zone.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    submittedResult = undefined;
    // Stored as 07:30 UTC, shown as Amsterdam's (summer time) 09:30.
    const input = (await canvas.findByDisplayValue(/^2024-05-01T09:30/, {}, { timeout: 5000 })) as
      HTMLInputElement;

    // A real focus/blur pair: React's onBlur listens for focusout, which a synthetic "blur" lacks.
    input.focus();
    fireEvent.change(input, { target: { value: "2024-01-15T09:30" } });
    input.blur();
    await waitFor(() => expect(input.value).toMatch(/^2024-01-15T09:30/));

    await userEvent.click(await canvas.findByRole("button", { name: "Update" }));
    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });
    // Winter time: written with Amsterdam's CET offset.
    expect(result.additions.map((quad) => quad.object.value)).toEqual([
      "2024-01-15T09:30:00+01:00",
    ]);
  },
};
