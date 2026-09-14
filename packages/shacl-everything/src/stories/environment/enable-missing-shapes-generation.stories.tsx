import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableMissingShapesGeneration: shapesGraph declares no shape at all for schema:Dog -
// off (the default), nothing renders for it; on, preprocess/shapes.ts's addMissingShapes mints an
// implicit sh:NodeShape (+ a bare sh:property/sh:path per predicate actually used) so the
// otherwise-unshaped data still renders as something editable.
export default {
  title: "Environment/enableMissingShapesGeneration",
  component: ShaclRenderer,
};

// No shape at all - there is genuinely nothing for a shape-unaware render to expand until
// addMissingShapes says something about it on its own.
const shapesGraph = `
  @prefix ex: <http://example.org/> .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a ex:Dog ; schema:name "Tom" ; ex:age "3" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  // addMissingShapes mints its generated shape's subject as the class IRI itself (3.1.3.3's
  // implicit class target - see that preprocessor's own doc comment), so a caller who already
  // knows the class can reference it directly here. Off, ex:Dog has zero shape triples describing
  // it anywhere in shapesGraph, so there's nothing for a shape-unaware render to expand yet.
  nodeShapes: [factory.namedNode("http://example.org/Dog")],
  focusNode: factory.namedNode("http://example.org/data"),
};

export const disabled: Story = {
  name: "Off (the default): an unshaped class renders no fields at all",
  args: { ...baseArgs, enableMissingShapesGeneration: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("button", { name: "Update" })).toBeInTheDocument());
    expect(canvas.queryAllByRole("textbox")).toHaveLength(0);
  },
};

export const enabled: Story = {
  name: "On: the same data renders one field per predicate actually found on it",
  args: { ...baseArgs, enableMissingShapesGeneration: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Tom", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("3", {}, { timeout: 5000 });
  },
};
