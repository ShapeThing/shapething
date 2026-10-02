import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableUndoRedo: edit mode only. Ctrl+Z/Ctrl+Y undo/redo committed edits to
// dataGraph for the current session, ignored while focus is inside a text input so native
// text-undo still works for an in-progress edit.
export default {
  title: "Environment/enableUndoRedo",
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

export const disabled: Story = {
  name: "Off (the default is on - shown here for contrast): Ctrl+Z after committing an edit does nothing",
  args: { ...baseArgs, enableUndoRedo: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });

    await userEvent.clear(input);
    await userEvent.type(input, "Klaas");
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveValue("Klaas"));

    await userEvent.keyboard("{Control>}z{/Control}");
    // No undo history was ever recorded - the value stays exactly as committed.
    expect(input).toHaveValue("Klaas");
  },
};

export const enabled: Story = {
  name: "On: Ctrl+Z reverts a committed field edit, Ctrl+Y redoes it",
  args: { ...baseArgs, enableUndoRedo: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue("Hendrik", {}, { timeout: 5000 });

    await userEvent.clear(input);
    await userEvent.type(input, "Klaas");
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveValue("Klaas"));

    await userEvent.keyboard("{Control>}z{/Control}");
    await waitFor(() => expect(input).toHaveValue("Hendrik"));

    await userEvent.keyboard("{Control>}y{/Control}");
    await waitFor(() => expect(input).toHaveValue("Klaas"));
  },
};
