import type { StoryObj } from "@storybook/react-vite";
import { userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import type { SubmitResult } from "@/environment.ts";
import { sh } from "@/helpers/namespaces.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.facetChangeMode: facet mode only. "live" (the default) calls onSubmit continuously,
// debounced, as facets change - "submit" instead withholds every call until an explicit "Apply
// filters" button is clicked.
export default {
  title: "Environment/facetChangeMode",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Product ;
    sh:property [ sh:name "Search"@en ; sh:path schema:name ; sh:datatype xsd:string ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:widget a schema:Product ; schema:name "Widget" .
`;

let submitCount = 0;
let lastResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitCount++;
  lastResult = result;
};

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  mode: "facet",
  onSubmit,
};

export const liveMode: Story = {
  name: '"live" (the default): onSubmit fires on mount, then again (debounced) whenever a facet changes',
  args: { ...baseArgs, facetChangeMode: "live" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    submitCount = 0;
    const canvas = within(canvasElement);
    const search = await canvas.findByLabelText("Search", {}, { timeout: 5000 });
    await waitFor(() => {
      if (submitCount < 1) throw new Error("onSubmit has not fired on mount yet");
    });

    await userEvent.type(search, "widget");
    await waitFor(() => {
      if (submitCount < 2) throw new Error("onSubmit has not fired again after the facet change");
      if (lastResult?.dataGraph.getQuads(null, sh("pattern")).length !== 1) {
        throw new Error("the generated filter shape doesn't reflect the typed search yet");
      }
    });
  },
};

export const submitMode: Story = {
  name: '"submit": typing into a facet never calls onSubmit until "Apply filters" is clicked',
  args: { ...baseArgs, facetChangeMode: "submit" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    submitCount = 0;
    const canvas = within(canvasElement);
    const search = await canvas.findByLabelText("Search", {}, { timeout: 5000 });

    await userEvent.type(search, "widget");
    // Give the "live" debounce window (200ms) time to prove it's genuinely not firing here.
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (submitCount !== 0) throw new Error("onSubmit fired before Apply filters was clicked");

    await userEvent.click(canvas.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => {
      if (submitCount !== 1) throw new Error("onSubmit did not fire exactly once after Apply filters");
    });
  },
};
