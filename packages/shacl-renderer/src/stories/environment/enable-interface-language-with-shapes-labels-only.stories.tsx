import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableInterfaceLanguageWithShapesLabelsOnly: when true, a language tag found on
// sh:name/sh:description in shapesGraph but not covered by a shipped/overridden .ftl locale is
// still offered in InterfaceLanguageSwitcher (chrome text just falls back for it). When false,
// interfaceLanguages is exactly the .ftl locale set (en-GB, nl-NL here) - "de" never shows up even
// though the shape declares an sh:name in it. True in defaultEnvironment, false in
// minimalEnvironment.
export default {
  title: "Environment/enableInterfaceLanguageWithShapesLabelsOnly",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Name"@en, "Name"@de ; sh:path schema:name ; sh:datatype xsd:string ] .
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

async function openInterfaceLanguageMenu(canvasElement: HTMLElement): Promise<void> {
  const trigger = canvasElement.querySelector<HTMLButtonElement>(
    ".st-interface-language-switcher .st-listbox__trigger",
  );
  if (!trigger) throw new Error("Could not find the interface language switcher");
  await userEvent.click(trigger);
}

export const disabled: Story = {
  name: 'Off (minimalEnvironment\'s own setting): "de" never appears, even though the shape has sh:name@de',
  args: {
    ...baseArgs,
    enableInterfaceLanguageWithShapesLabelsOnly: false,
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });
    await openInterfaceLanguageMenu(canvasElement);
    expect(canvasElement.querySelector('.st-interface-language-switcher [data-value="de"]')).toBeNull();
  },
};

export const enabled: Story = {
  name: 'On (defaultEnvironment\'s own setting): "de" is offered too, picked up from the shape\'s own sh:name@de',
  args: {
    ...baseArgs,
    enableInterfaceLanguageWithShapesLabelsOnly: true,
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });
    await openInterfaceLanguageMenu(canvasElement);
    expect(
      canvasElement.querySelector('.st-interface-language-switcher [data-value="de"]'),
    ).not.toBeNull();
  },
};
