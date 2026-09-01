import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { sh } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// st:NumberRangeFacet is a ShapeThing-original facet widget - facets have no SHACL-UI spec clause
// yet (unlike the shui: editors/viewers under "SHACL 1.2 UI"), so this lives in its own stories
// bucket, same precedent as st:CollapsiblePropertyGroup (see "ShapeThing/Groups").
export default {
  title: "ShapeThing/Facets/st:NumberRangeFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet" },
};

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx) -
// every story already gets a turtle preview of it for free in Storybook's "Submit" panel (see
// .storybook/withSubmitPreview.tsx), this closure is purely so play() has something to assert
// against.
let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stNumberRangeFacet: Story = {
  name: "xsd:decimal price, aggregated across three products",
  args: { ...argsByTestFile("st-number-range-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);
    const [minInput, maxInput] = await canvas.findAllByRole("spinbutton");

    // The bounds shown (as placeholders, and as the native <input min>/<max>) are derived from
    // the actual data graph - the lowest/highest schema:price found across all three products
    // (19.99, 42.50, 5.00), not anything declared on the shape itself.
    expect(minInput).toHaveAttribute("placeholder", "5");
    expect(minInput).toHaveAttribute("min", "5");
    expect(minInput).toHaveAttribute("max", "42.5");
    expect(maxInput).toHaveAttribute("placeholder", "42.5");

    await userEvent.type(minInput, "10");

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      const values = submitResult.dataGraph
        .getQuads(null, sh("minInclusive"))
        .map((quad) => quad.object.value);
      expect(values).toEqual(["10"]);
    });
  },
};

// The native <input min>/<max> attributes above are only enforced by the browser at form
// submission - and facet mode's default "live" facetChangeMode never submits a form - so an
// out-of-bounds value typed here would otherwise sit there unenforced. Clamped on blur instead,
// to the nearest known data bound (5 - 42.5), so typing itself is never fought mid-value.
export const clampsOutOfBoundsOnBlur: Story = {
  name: "clamps an out-of-bounds value to the nearest known bound on blur",
  args: { ...argsByTestFile("st-number-range-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);
    const [minInput, maxInput] = await canvas.findAllByRole("spinbutton");

    await userEvent.type(minInput, "999");
    await userEvent.tab();
    expect(minInput).toHaveValue(42.5);

    await userEvent.type(maxInput, "-5");
    await userEvent.tab();
    expect(maxInput).toHaveValue(5);

    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      expect(
        submitResult.dataGraph.getQuads(null, sh("minInclusive")).map((quad) => quad.object.value),
      ).toEqual(["42.5"]);
      expect(
        submitResult.dataGraph.getQuads(null, sh("maxInclusive")).map((quad) => quad.object.value),
      ).toEqual(["5"]);
    });
  },
};
