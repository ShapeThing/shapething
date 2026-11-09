import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { RdfStore } from "rdf-stores";
import { factory } from "@/helpers/factory.ts";
import { makeReactive } from "@/helpers/reactiveRdfStore.ts";

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

// A live dataGraph (makeReactive): a predicate the data gains after the first render - data that
// arrives later - gets its generated property too (EnvironmentContextProvider preprocesses again).
// In view mode, with st:missingPropertiesGroup, the generated properties go in that group on the
// shape that is shown.
const liveDataGraph = makeReactive(RdfStore.createDefault());
liveDataGraph.addQuad(
  factory.quad(
    factory.namedNode("http://example.org/data"),
    factory.namedNode("http://schema.org/name"),
    factory.literal("Tom"),
  ),
);

export const laterData: Story = {
  name: "On, in a group of the shape shown: data that arrives later gets its properties too",
  args: {
    mode: "view",
    enableMissingShapesGeneration: true,
    shapesGraph: `
      @prefix ex: <http://example.org/> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix st: <http://shapething.com/> .
      ex:DogView a sh:NodeShape ; st:missingPropertiesGroup ex:rest .
      ex:rest a sh:PropertyGroup ; sh:name "Everything else"@en ; st:cssClass "rest" .
    `,
    nodeShapes: [factory.namedNode("http://example.org/DogView")],
    focusNode: factory.namedNode("http://example.org/data"),
  } as ShaclRendererProps,
  // The live store is not an arg: args are compared as JSON, which a store is not.
  render: (args) => <ShaclRenderer {...args} dataGraph={liveDataGraph} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("Tom", {}, { timeout: 5000 });
    liveDataGraph.addQuad(
      factory.quad(
        factory.namedNode("http://example.org/data"),
        factory.namedNode("http://example.org/age"),
        factory.literal("3"),
      ),
    );
    const age = await canvas.findByText("3", {}, { timeout: 5000 });
    expect(age.closest(".rest")).not.toBeNull();
  },
};
