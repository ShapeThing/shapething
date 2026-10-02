import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.interfaceLocales: overrides/removes a built-in .ftl interface locale (see
// l10n/locales.ts's mergeLocaleLoaders), layered under Environment.interfaceLanguages -
// InterfaceLanguageSwitcher only renders once more than one interface language is actually
// available (see its own `interfaceLanguages.length > 1` check).
export default {
  title: "Environment/interfaceLocales",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Name"@en ; sh:path schema:name ; sh:datatype xsd:string ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person ; schema:name "Hendrik" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

export const defaultLocalesShowTheSwitcher: Story = {
  name: "Default: both shipped locales (en-GB, nl-NL) available - InterfaceLanguageSwitcher renders",
  args: baseArgs as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });
    expect(canvasElement.querySelector(".st-interface-language-switcher")).not.toBeNull();
  },
};

export const removingALocaleHidesTheSwitcher: Story = {
  name: 'interfaceLocales: { "nl-NL": null } removes Dutch entirely - down to one language, the switcher renders nothing',
  args: {
    ...baseArgs,
    interfaceLocales: { "nl-NL": null },
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });
    expect(canvasElement.querySelector(".st-interface-language-switcher")).toBeNull();
  },
};
