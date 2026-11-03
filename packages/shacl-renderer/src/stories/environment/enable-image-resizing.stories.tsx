import type { StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableImageResizing: shui:ImageViewer loads a remote image through https://wsrv.nl,
// resized to about the size it is shown at, instead of downloading the full original. Data and
// blob URLs, local hosts and SVGs are always loaded directly.
export default {
  title: "Environment/enableImageResizing",
  component: ShaclRenderer,
};

const image =
  "https://upload.wikimedia.org/wikipedia/commons/6/6d/Good_Food_Display_-_NCI_Visuals_Online.jpg";

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Recipe ;
    sh:property [ sh:name "Image"@en ; sh:path schema:image ; sh:nodeKind sh:IRI ; shui:viewer shui:ImageViewer ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Recipe ; schema:image <${image}> .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  mode: "view",
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

export const enabled: Story = {
  name: "On (the default): the image is loaded resized through wsrv.nl",
  args: { ...baseArgs, enableImageResizing: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(canvasElement.querySelector("img.image-viewer")?.getAttribute("src")).toBe(
          `https://wsrv.nl/?url=${encodeURIComponent(image)}&w=1200&h=600&fit=inside&we=`,
        ),
      {
        timeout: 5000,
      },
    );
  },
};

export const disabled: Story = {
  name: "Off: the original image is loaded",
  args: { ...baseArgs, enableImageResizing: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(canvasElement.querySelector("img.image-viewer")?.getAttribute("src")).toBe(image),
      {
        timeout: 5000,
      },
    );
  },
};
