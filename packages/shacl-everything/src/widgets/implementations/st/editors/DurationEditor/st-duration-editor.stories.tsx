import type { StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:DurationEditor is a ShapeThing-original editor, ported from shacl-renderer's own
// DurationEditor - not part of the SHACL 1.2 Core spec or the shui: extension proposal, so it
// lives in its own stories folder rather than alongside the spec-conformance suite, colocated with
// its implementation (see widget.tsx). It wraps the third-party react-duration-control, which
// renders one small text input per configured unit (here hours+minutes, via st:durationPattern -
// see st-duration-editor.ttl).
export default {
  title: "Specifications/ShapeThing (living document)/Editors/st:DurationEditor",
  component: ShaclRenderer,
  args: minimalEnvironment,
};

export const stDurationEditor: Story = {
  name: "A cook time of 15 minutes",
  args: argsByTestFile("st-duration-editor.ttl", import.meta.url),
};

export const stDurationEditorEdit: Story = {
  name: "Typing a new hour value commits and round-trips through the underlying xsd:duration",
  args: argsByTestFile("st-duration-editor.ttl", import.meta.url),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The form is suspense-loaded (see CLAUDE.md's Environment/preprocessing notes), so the
    // control isn't necessarily there on play()'s first tick - wait for it rather than assuming.
    const hourInput = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLInputElement>(
        ".duration-control-unit-input.hour",
      );
      if (!element) throw new Error("Could not find the hour unit input");
      return element;
    });
    const minuteInput = canvasElement.querySelector<HTMLInputElement>(
      ".duration-control-unit-input.minute",
    );
    if (!minuteInput) throw new Error("Could not find the minute unit input");

    expect(hourInput.value).toBe("00");
    expect(minuteInput.value).toBe("15");

    fireEvent.change(hourInput, { target: { value: "2" } });
    fireEvent.blur(hourInput);

    // Committing writes an xsd:duration literal back to dataGraph (see duration.ts's
    // termFromMilliseconds) and this widget re-derives its displayed unit values from that
    // literal on the next render - asserting the hour/minute inputs still read 2h15m after the
    // round trip proves the write didn't lose precision, not just that the DOM updated.
    await waitFor(() => expect(hourInput.value).toBe("02"));
    await expect(canvas.findByDisplayValue("15")).resolves.toBeVisible();
  },
};
