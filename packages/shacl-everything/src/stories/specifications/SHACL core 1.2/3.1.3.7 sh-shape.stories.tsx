import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { fixtureUrl } from "@/helpers/argsByTestFile.ts";

type Story = StoryObj<ShaclRendererProps>;

// 3.1.3.7 Explicit shape targets: the DATA graph's own `<node> sh:shape <shapeIri>`. Only a
// dataGraph and focusNode are given here - no shapesGraph, no nodeShapes - so the shape can only
// come from preprocess/resolveRdfSources.ts's dereferenceShapeTargets fetching the sh:shape IRI
// (3.1.3.7 sh-shape.shape.ttl, a separate colocated fixture) over real HTTP, and nodeShapes from
// shapesTargetingNode picking it up as the focus node's explicit target.
export default {
  title: "Specifications/SHACL core 1.2/3. Shapes and Constraints/3.1.3.7 sh:shape",
  component: ShaclRenderer,
};

export const shShape: Story = {
  name: "A focus node's own sh:shape is dereferenced when no shapes graph is given",
  args: {
    dataGraph: fixtureUrl("3.1.3.7 sh-shape.ttl", import.meta.url),
    focusNode: factory.namedNode(fixtureUrl("3.1.3.7 sh-shape.ttl#data", import.meta.url).href),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The labels only exist in the dereferenced shape document, never in the data graph.
    await canvas.findByText("First name", {}, { timeout: 5000 });
    await canvas.findByText("Last name", {}, { timeout: 5000 });
    await expect(await canvas.findByDisplayValue("Hendrik")).toBeInTheDocument();
    await expect(await canvas.findByDisplayValue("Jansen")).toBeInTheDocument();
  },
};
