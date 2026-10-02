import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableFullLanguageRemoval: shows a trash icon on each row of the content language
// switcher (edit mode only) to delete every value in that language entirely, after confirming in
// a modal. Off by default in a from-scratch Environment, but defaultEnvironment turns it on.
export default {
  title: "Environment/enableFullLanguageRemoval",
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
  mode: "edit",
};

async function openContentLanguageMenu(canvasElement: HTMLElement): Promise<void> {
  const trigger = canvasElement.querySelector<HTMLButtonElement>(
    ".st-content-language-switcher__trigger",
  );
  if (!trigger) throw new Error("Could not find the content language switcher");
  await userEvent.click(trigger);
}

export const disabled: Story = {
  name: "Off (the default): no delete icon on any language row",
  args: { ...baseArgs, enableFullLanguageRemoval: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await openContentLanguageMenu(canvasElement);
    expect(canvasElement.querySelector(".st-content-language-switcher__delete")).toBeNull();
  },
};

export const enabled: Story = {
  name: "On (defaultEnvironment's own setting): each row shows a delete icon to remove that language's content",
  args: { ...baseArgs, enableFullLanguageRemoval: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await openContentLanguageMenu(canvasElement);
    expect(canvasElement.querySelector(".st-content-language-switcher__delete")).not.toBeNull();
  },
};
