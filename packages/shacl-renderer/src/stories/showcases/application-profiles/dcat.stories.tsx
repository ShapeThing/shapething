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
    enablePropertyShapeSources: true,
  },
};

// dcat-ap-nl-drawer-groups.ttl is a purely additive overlay (see its own header comment) - it adds
// one st:DrawerPropertyGroup per showcased shape and moves that shape's own optional properties
// into it, entirely via sh:group triples on dcat-ap-nl-LBL.ttl's existing named property shapes,
// without editing either generated file in place - same approach as the RDA-FR showcase's own
// rdafr-shacl-drawer-groups.ttl.
// DCAT AP NL layers on top of DCAT AP EU rather than linking to it: dcat-ap-eu-SHACL.ttl's own node
// shapes only share sh:targetClass with the NL ones (no sh:node/sh:and between them), so an explicit
// nodeShapes list has to name both for the EU property shapes to be merged in.
const dcatApEu = "https://semiceu.github.io/DCAT-AP/releases/3.0.0/html/shacl/shapes.ttl#";
const dcatApNl = "http://modellen.geostandaarden.nl/dcat-ap-nl/id/shape/";
const nlAndEuShapes = (name: string) => [
  factory.namedNode(`${dcatApNl}${name}Shape`),
  factory.namedNode(`${dcatApEu}${name}_Shape`),
];

const files = [
  "dcat-ap-nl-SHACL.ttl",
  "dcat-ap-eu-SHACL.ttl",
  "dcat-ap-nl-LBL.ttl",
  "dcat-ap-nl-configuration.ttl",
  "dcat-ap-nl-description-NL.ttl",
  "dcat-ap-nl-drawer-groups.ttl",
];

export const dataset: Story = {
  name: "Dataset",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: nlAndEuShapes("Dataset"),
  },
};

export const distribution: Story = {
  name: "Distribution",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: nlAndEuShapes("Distribution"),
  },
};

export const dataService: Story = {
  name: "DataService",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: nlAndEuShapes("DataService"),
  },
};

export const catalog: Story = {
  name: "Catalog",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: nlAndEuShapes("Catalog"),
  },
};

export const datasetSeries: Story = {
  name: "DatasetSeries",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: nlAndEuShapes("DatasetSeries"),
  },
};

export const catalogRecord: Story = {
  name: "CatalogRecord",
  args: {
    ...argsByTestFile(files, import.meta.url),
    nodeShapes: nlAndEuShapes("CatalogRecord"),
  },
};
