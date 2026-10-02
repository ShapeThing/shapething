import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.languageMode: "switcher" (the default) shows one rdf:langString translation at a
// time, controlled by one global ContentLanguageSwitcher; "individual" instead renders every
// existing translation side by side, each with its own per-value language selector, and no global
// switcher at all. See Tests/Interaction/Language mode for the full interaction-level coverage
// (retagging a value's language, etc.) - this story is scoped to just the structural difference.
export default {
  title: "Environment/languageMode",
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

export const switcherMode: Story = {
  name: '"switcher" (the default): one translation shown at a time, plus a global switcher',
  args: { ...baseArgs, languageMode: "switcher" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    expect(canvas.queryAllByRole("textbox")).toHaveLength(1);
    expect(canvasElement.querySelector(".st-content-language-switcher")).not.toBeNull();
  },
};

export const individualMode: Story = {
  name: '"individual": every translation renders at once, each with its own language selector, no global switcher',
  args: { ...baseArgs, languageMode: "individual" } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Redhead", {}, { timeout: 5000 });
    await canvas.findByDisplayValue("Roodharige", {}, { timeout: 5000 });
    expect(canvasElement.querySelector(".st-content-language-switcher")).toBeNull();
  },
};
