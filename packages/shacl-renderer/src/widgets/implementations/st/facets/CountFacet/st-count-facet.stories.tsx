import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:CountFacet filters on how many values an instance holds on a path, not on the values
// themselves - opt-in only, via st:facet. Same bucket as the other ShapeThing-original facets (see
// st:NumberRangeFacet's stories).
export default {
  title: "Specifications/ShapeThing (living document)/Facets/st:CountFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stCountFacet: Story = {
  name: "Number of authors, from 0 (an anonymous book) to 3",
  args: { ...argsByTestFile("st-count-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);
    const [minInput, maxInput] = await canvas.findAllByRole("spinbutton");

    // The bounds come from the data: "Anonymous" has no author at all (0), "Anthology" has three.
    await waitFor(() => {
      expect(minInput).toHaveAttribute("placeholder", "0");
      expect(maxInput).toHaveAttribute("placeholder", "3");
      expect(maxInput).toHaveAttribute("max", "3");
    });

    await userEvent.type(minInput, "2");

    // Plain sh:minCount on the generated filter shape's property - its ordinary SHACL meaning.
    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      expect(
        submitResult.dataGraph.getQuads(null, sh("minCount")).map((quad) => quad.object.value),
      ).toEqual(["2"]);
      expect(submitResult.dataGraph.getQuads(null, sh("qualifiedValueShape"))).toEqual([]);
    });

    await userEvent.type(maxInput, "9");
    await userEvent.tab();
    expect(maxInput).toHaveValue(3);
  },
};

// With counts enabled, the facet shows how many instances its own range currently matches.
export const stCountFacetWithMatchCount: Story = {
  name: "Shows how many books match the chosen range",
  args: {
    ...argsByTestFile("st-count-facet.ttl", import.meta.url),
    enableFacetOptionCounts: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [, maxInput] = await canvas.findAllByRole("spinbutton");
    await userEvent.type(maxInput, "1");
    // "Solo" (1 author) and "Anonymous" (0).
    await waitFor(() =>
      expect(canvasElement.querySelector(".st-form-element__count-badge")?.textContent).toBe("2"),
    );
  },
};
