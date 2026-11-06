import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { RdfStore } from "rdf-stores";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { ex, schema } from "@/helpers/namespaces.ts";
import { makeReactive, untracked } from "@/helpers/reactiveRdfStore.ts";

type Story = StoryObj<ShaclRendererProps>;

// RawEnvironment.dataGraph as a live store: a store made reactive with makeReactive() is used
// as-is instead of copied. Data the caller adds later (here: a description that arrives after the
// person) shows up in place - the form is not rebuilt, so the image already shown is not loaded
// again and nothing falls back to "Loading".
export default {
  title: "Environment/dataGraph (live store)",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:property [
      sh:name "Image"@en ; sh:path schema:image ; sh:order 0 ; sh:maxCount 1 ;
      sh:nodeKind sh:IRI ; shui:viewer shui:ImageViewer ;
    ] ;
    sh:property [ sh:name "Name"@en ; sh:path schema:name ; sh:order 1 ] ;
    sh:property [ sh:name "Description"@en ; sh:path schema:description ; sh:order 2 ] .
`;

// A data URL, so the story doesn't depend on the network.
const image = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="tan"/></svg>',
)}`;

const description = factory.quad(
  ex("ada"),
  schema("description"),
  factory.literal("Wrote the first published algorithm for a machine.", "en"),
);

// Built fresh per story render (a loader) and kept module-level rather than passed as an arg -
// Storybook must never try to serialise a raw RdfStore.
let dataGraph: RdfStore;

export const laterData: Story = {
  name: "Data added to the store later shows up in place",
  loaders: [
    () => {
      const store = RdfStore.createDefault();
      store.addQuad(factory.quad(ex("ada"), schema("name"), factory.literal("Ada Lovelace")));
      store.addQuad(factory.quad(ex("ada"), schema("image"), factory.namedNode(image)));
      dataGraph = makeReactive(store);
      return {};
    },
  ],
  args: {
    shapesGraph,
    mode: "view",
    focusNode: ex("ada"),
    nodeShapes: [ex("shape")],
  } as ShaclRendererProps,
  render: (args) => <ShaclRenderer {...args} dataGraph={dataGraph} />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector("img")).toBeTruthy(), {
      timeout: 5000,
    });
    const img = canvasElement.querySelector("img");
    expect(canvasElement).not.toHaveTextContent("first published algorithm");

    let reloaded = false;
    const observer = new MutationObserver(() => {
      if (canvasElement.querySelector(".st-environment-context-provider__loading")) {
        reloaded = true;
      }
    });
    observer.observe(canvasElement, { childList: true, subtree: true });

    // Data arriving, not an edit: no undo step.
    untracked(dataGraph, () => dataGraph.addQuad(description));

    await waitFor(() => expect(canvasElement).toHaveTextContent("first published algorithm"));
    observer.disconnect();
    expect(reloaded).toBe(false);
    // The very same element: the image was not rendered (and loaded) again.
    expect(canvasElement.querySelector("img")).toBe(img);
  },
};
