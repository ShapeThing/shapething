import type { StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "ShapeThing/Facets/st:DateRangeFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx).
let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stDateRangeFacet: Story = {
  name: "xsd:date startDate, aggregated across two events",
  args: { ...argsByTestFile("st-date-range-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    // Widget resolution (react-query) is async, so the <input>s settle slightly after the
    // property's <label> chrome - findAllByDisplayValue retries until they do.
    const [minInput] = (await within(canvasElement).findAllByDisplayValue(
      "",
    )) as HTMLInputElement[];

    fireEvent.change(minInput, { target: { value: "2026-04-01" } });

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const values = submitResult.dataGraph
        .getQuads(null, sh("minInclusive"))
        .map((quad) => quad.object.value);
      expect(values).toEqual(["2026-04-01"]);
    });
  },
};
