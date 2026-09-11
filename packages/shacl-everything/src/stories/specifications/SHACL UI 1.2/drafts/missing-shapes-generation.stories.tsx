import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// Draft: Environment.enableMissingShapesGeneration is a new, not-yet-spec'd extension (no shui:
// term for it) - lives outside "Specifications/SHACL UI 1.2/" until/unless it's formalized. When
// on, preprocess/shapes.ts's addMissingShapes scans dataGraph for classes no shape in shapesGraph
// already covers, and mints one: an implicit class-shape (3.1.3.3 - the class IRI itself, typed
// both sh:NodeShape and rdfs:Class) carrying a bare sh:property/sh:path for every predicate
// actually used by that class's own instances. Off by default - see Environment's own doc comment
// for why.
export default {
  title: "Specifications/SHACL UI 1.2/drafts/Missing shapes generation",
  component: ShaclRenderer,
};

// missing-shapes-generation.ttl declares no shape at all - <#shape> (the fixture's usual
// nodeShapes/argsByTestFile convention) has zero triples describing it anywhere in the fixture, so
// there is genuinely nothing for a shape-unaware render to expand until addMissingShapes says
// something about it on its own.
const baseArgs: ShaclRendererProps = argsByTestFile(
  "missing-shapes-generation.ttl",
  import.meta.url,
);

export const withoutGeneration: Story = {
  name: "Without the flag, an unshaped class renders no fields at all",
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The submit button always renders regardless of how many properties NodeUIComponent found -
    // waiting for it is a reliable "the form has finished mounting" signal before asserting on the
    // absence of any field.
    await waitFor(() => expect(canvas.getByRole("button", { name: "Update" })).toBeInTheDocument());
    expect(canvas.queryAllByRole("textbox")).toHaveLength(0);
  },
};

export const withGeneration: Story = {
  name: "With enableMissingShapesGeneration, the same data renders one field per predicate found in it",
  args: { ...baseArgs, enableMissingShapesGeneration: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const timeout = { timeout: 5000 };
    await canvas.findByDisplayValue("Tom", {}, timeout);
    await canvas.findByDisplayValue("3", {}, timeout);
    expect(canvas.getAllByRole("textbox")).toHaveLength(2);
  },
};
