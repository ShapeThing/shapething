import type { StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// Delegates to DateRangeFacet's own widget.tsx (type="datetime-local"), the same way
// shui:DateTimePickerEditor delegates to a sibling TextFieldEditor - see the widget's own comment.
export default {
  title: "ShapeThing/Facets/st:DateTimeRangeFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx).
let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stDateTimeRangeFacet: Story = {
  name: "xsd:dateTime startDate, aggregated across two events",
  args: { ...argsByTestFile("st-date-time-range-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    // Widget resolution (react-query) is async, so the <input>s settle slightly after the
    // property's <label> chrome - findAllByDisplayValue retries until they do.
    const [maxInput] = (
      (await within(canvasElement).findAllByDisplayValue("")) as HTMLInputElement[]
    ).slice(-1);

    fireEvent.change(maxInput, { target: { value: "2026-04-01T12:00" } });

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const values = submitResult.dataGraph
        .getQuads(null, sh("maxInclusive"))
        .map((quad) => quad.object.value);
      expect(values).toEqual(["2026-04-01T12:00"]);
    });
  },
};
