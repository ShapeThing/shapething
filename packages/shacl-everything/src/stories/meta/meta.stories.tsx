import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile, fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { testingEnvironment } from "@/environment.ts";
import { factory } from "@/helpers/factory.ts";

// shape.ttl's <#shape> only holds the properties common to every shape kind (Title/Description) -
// a Node Shape's own targeting/constraint properties live in <#nodeShape>, composed alongside it
// here since argsByTestFile's default nodeShapes only ever points at the fixture's own <#shape>.
// Built via fixtureUrl (not a literal `new URL(...)` here) so it resolves against the same
// unhashed fixture URL as argsByTestFile's own shapesGraph - see fixtureUrl's own comment.
const nodeShapeNodeShapes = [
  factory.namedNode(fixtureUrl("shape.ttl#nodeShape", import.meta.url).href),
];

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Meta",
  component: ShaclRenderer,
  args: {
    ...testingEnvironment,
    enableMissingShapesGeneration: true,
    corsProxyUrl: "https://cors.shapething.com/?url=",
    enableEditInPlace: true,
  },
  parameters: {
    maxWidth: "1000px",
  },
};

export const ontologyNoData: Story = {
  name: "Ontology (no data)",
  args: {
    ...argsByTestFile("ontology.ttl", import.meta.url),
  },
};

export const ontologyWithData1: Story = {
  name: "Ontology (with data 1)",
  args: {
    ...argsByTestFile(
      ["ontology.ttl", "./examples/nl-sbb-begrippenkader/model.ttl"],
      import.meta.url,
    ),
    focusNode: factory.namedNode("https://data.norg.nl/def/begrippenkader#"),
  },
};

export const ontologyWithData2: Story = {
  name: "Ontology (with data 2)",
  args: {
    ...argsByTestFile(
      ["ontology.ttl", "./examples/dcat-ap-nl-catalogus/model.ttl"],
      import.meta.url,
    ),
    focusNode: factory.namedNode("https://data.norg.nl/def/opendata#"),
  },
};

export const nodeShapeNoData: Story = {
  name: "Node Shape (no data)",
  args: {
    ...argsByTestFile("shape.ttl", import.meta.url),
    nodeShapes: nodeShapeNodeShapes,
  },
};

export const nodeShapeWithData1: Story = {
  name: "Node Shape (with data 1)",
  args: {
    ...argsByTestFile(["shape.ttl", "./examples/nl-sbb-begrippenkader/model.ttl"], import.meta.url),
    nodeShapes: nodeShapeNodeShapes,
    focusNode: factory.namedNode("https://data.norg.nl/def/begrippenkader#ConceptShape"),
  },
};

export const nodeShapeWithData2: Story = {
  name: "Node Shape (with data 2)",
  args: {
    ...argsByTestFile(["shape.ttl", "./examples/nl-sbb-begrippenkader/model.ttl"], import.meta.url),
    nodeShapes: nodeShapeNodeShapes,
    focusNode: factory.namedNode("https://data.norg.nl/def/begrippenkader#ConceptShape"),
  },
};

export const nodeShapeWithData3: Story = {
  name: "Node Shape (with data 3)",
  args: {
    ...argsByTestFile(["shape.ttl", "./examples/nl-sbb-begrippenkader/model.ttl"], import.meta.url),
    nodeShapes: nodeShapeNodeShapes,
    focusNode: factory.namedNode("http://nlbegrip.nl/def/skosapnl#Concept"),
  },
};
