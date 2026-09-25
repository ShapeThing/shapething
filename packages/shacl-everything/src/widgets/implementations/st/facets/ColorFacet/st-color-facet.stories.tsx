import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { minimalEnvironment } from "@/environment.ts";
import { sh, st } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Specifications/ShapeThing (living document)/Facets/st:ColorFacet",
  component: ShaclRenderer,
  args: { ...minimalEnvironment, mode: "facet", enableFacetOptionCounts: true },
};

// Facet mode calls the very same onSubmit callback edit mode uses (see modes/facet/index.tsx) -
// in "live" mode (the default), it fires a fresh SubmitResult snapshot on every debounced change.
let submitResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitResult = result;
};

export const stColorFacet: Story = {
  name: "Color values (genuine HSL) bucket by hue - a single st:colorBucket pick, not a range",
  args: { ...argsByTestFile("st-color-facet.ttl", import.meta.url), onSubmit },
  play: async ({ canvasElement }) => {
    submitResult = undefined;
    const canvas = within(canvasElement);

    // Five distinct HSL colors (two reds, one blue, one green, one gray) collapse into four
    // buckets - "Red" carries both hue-0 and hue-3 values, so its count is 2, not 5 separate
    // options.
    const red = (await canvas.findByLabelText("Red (2)")) as HTMLInputElement;
    const blue = (await canvas.findByLabelText("Blue (1)")) as HTMLInputElement;
    await canvas.findByLabelText("Green (1)");
    await canvas.findByLabelText("Gray (1)");
    expect(red.checked).toBe(false);

    await userEvent.click(red);
    await waitFor(() => expect(red.checked).toBe(true));

    // Clicking the "Red" bucket writes its own name as a single st:colorBucket value, not an
    // enumerated range - a sibling sh:sparql SPARQLConstraint (built from helpers/colorBuckets.ts's
    // sparqlFilterForBucket) is kept in sync alongside it (facets/filterShape.ts's
    // syncColorBucketSparqlConstraint), and that's what this renderer's own facet narrowing
    // actually validates against (facets/filterShape.ts's instancesConformingViaEngine) - not a
    // hand-rolled reclassification of each candidate's own st:hue/st:saturation/st:lightness.
    await waitFor(() => {
      if (!submitResult) throw new Error("onSubmit has not fired yet");
      expect(submitResult.dataGraph.getQuads(null, st("colorBucket"))[0]?.object.value).toEqual(
        "red",
      );
      const sparqlNode = submitResult.dataGraph.getQuads(null, sh("sparql"))[0]?.object;
      expect(sparqlNode).toBeDefined();
      const selectQuery = submitResult.dataGraph.getQuads(sparqlNode, sh("select"))[0]?.object.value;
      expect(selectQuery).toContain("st:hue");
      expect(selectQuery).toContain("?hue < 15 || ?hue >= 345");
    });

    // Single-select: picking a second bucket replaces the first entirely, rather than adding to
    // it.
    await userEvent.click(blue);
    await waitFor(() => expect(blue.checked).toBe(true));
    expect(red.checked).toBe(false);

    await waitFor(() => {
      expect(submitResult!.dataGraph.getQuads(null, st("colorBucket"))[0]?.object.value).toEqual(
        "blue",
      );
    });

    // Clicking the already-selected bucket again clears the selection entirely.
    await userEvent.click(blue);
    await waitFor(() => expect(blue.checked).toBe(false));

    await waitFor(() => {
      expect(submitResult!.dataGraph.getQuads(null, st("colorBucket"))).toEqual([]);
      expect(submitResult!.dataGraph.getQuads(null, sh("sparql"))).toEqual([]);
    });
  },
};
