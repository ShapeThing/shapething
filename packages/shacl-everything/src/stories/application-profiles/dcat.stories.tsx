import type { StoryObj } from "@storybook/react-vite";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { argsByTestFile } from "@/helpers/argsByTestFile.ts";
import { factory } from "@/helpers/factory.ts";
import { defaultEnvironment, minimalEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

export default {
  title: "Application profiles/DCAT AP NL",
  component: ShaclRenderer,
  args: {
    ...minimalEnvironment,
    interfaceLocales: {
      ...defaultEnvironment.interfaceLocales,
      "en-GB": undefined,
    },
    interfaceLanguage: "nl-NL",
    contentLanguage: "nl-NL",
    contentLanguages: ["nl-NL"],
  },
};

const files = [
  "dcat-ap-nl-SHACL.ttl",
  "dcat-ap-eu-SHACL.ttl",
  "dcat-ap-nl-LBL.ttl",
  "dcat-ap-nl-configuration.ttl",
  "dcat-ap-nl-description-NL.ttl",
];

export const dataset: Story = {
  name: "Dataset",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: [
      factory.namedNode("http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/DatasetShape"),
    ],
  },
};

export const distribution: Story = {
  name: "Distribution",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: [
      factory.namedNode("http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/DistributionShape"),
    ],
  },
};

export const dataService: Story = {
  name: "DataService",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: [
      factory.namedNode("http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/DataServiceShape"),
    ],
  },
};

export const catalog: Story = {
  name: "Catalog",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: [
      factory.namedNode("http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/CatalogShape"),
    ],
  },
};

export const datasetSeries: Story = {
  name: "DatasetSeries",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: [
      factory.namedNode("http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/DatasetSeriesShape"),
    ],
  },
};

export const catalogRecord: Story = {
  name: "CatalogRecord",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: [
      factory.namedNode("http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/CatalogRecordShape"),
    ],
  },
};
