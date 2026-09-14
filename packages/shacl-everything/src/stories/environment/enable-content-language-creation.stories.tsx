import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableContentLanguageCreation: adds an "Add language…" row to
// ContentLanguageSwitcher (languageMode "switcher") for minting a brand new BCP47 language at
// runtime, beyond whatever languages/sh:languageIn/data already supply.
export default {
  title: "Environment/enableContentLanguageCreation",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [ sh:name "Nickname"@en ; sh:path schema:name ; sh:datatype rdf:langString ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person ; schema:name "Redhead"@en, "Roodharige"@nl .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

async function openContentLanguageMenu(canvasElement: HTMLElement): Promise<void> {
  const trigger = canvasElement.querySelector<HTMLButtonElement>(
    ".st-content-language-switcher__trigger",
  );
  if (!trigger) throw new Error("Could not find the content language switcher");
  await userEvent.click(trigger);
}

export const disabled: Story = {
  name: 'Off (the default): the switcher offers only the existing languages, no "Add language…" row',
  args: { ...baseArgs, enableContentLanguageCreation: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await openContentLanguageMenu(canvasElement);
    expect(canvas.queryByText("Add language…")).toBeNull();
  },
};

export const enabled: Story = {
  name: 'On: an "Add language…" row lets the user mint a brand new BCP47 language at runtime',
  args: { ...baseArgs, enableContentLanguageCreation: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await openContentLanguageMenu(canvasElement);
    await canvas.findByText("Add language…");
  },
};
