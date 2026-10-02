import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableFocusNodeEditor: an "Identifier" field for the IRI of the resource the form is
// about. The rename is applied on submit - every quad using the old IRI, as subject or as object,
// is handed back using the new one (and SubmitResult.focusNode says which it is).
export default {
  title: "Environment/enableFocusNodeEditor",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  ex:PersonShape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:pattern "^http://example\\\\.org/people/" ;
    sh:property [
      sh:name "Name"@en ;
      sh:path schema:name ;
      sh:datatype xsd:string ;
      sh:maxCount 1 ;
    ] ;
    sh:property [
      sh:name "Knows"@en ;
      sh:path schema:knows ;
      sh:class schema:Person ;
      sh:nodeKind sh:IRI ;
      sh:node ex:PersonShape ;
      sh:maxCount 1 ;
      shui:editor shui:AutoCompleteEditor ;
    ] .
`;
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  <http://example.org/people/alice> a schema:Person ; schema:name "Alice" .
  <http://example.org/people/bob> a schema:Person ; schema:name "Bob" ;
    schema:knows <http://example.org/people/alice> .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/PersonShape")],
  focusNode: factory.namedNode("http://example.org/people/alice"),
};

let submitted: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submitted = result;
};

// Shown the same way as a SHACL validation result on a value.
const violation = (canvasElement: HTMLElement) =>
  waitFor(() => {
    const message = canvasElement.querySelector(
      '.st-focus-node-editor .st-validation-message[data-severity="Violation"]',
    );
    if (!message) throw new Error("No violation shown yet");
    return message;
  });

const identifierInput = async (canvasElement: HTMLElement) =>
  within(canvasElement).findByLabelText("Identifier", {}, { timeout: 5000 });

export const disabled: Story = {
  name: "Off (the default): no identifier field",
  args: baseArgs as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue("Alice", {}, { timeout: 5000 });
    expect(canvas.queryByLabelText("Identifier")).toBeNull();
  },
};

export const renamesOnSubmit: Story = {
  name: "On: the new IRI replaces the old one everywhere in what's submitted",
  args: { ...baseArgs, enableFocusNodeEditor: true, onSubmit } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    submitted = undefined;
    const canvas = within(canvasElement);
    const input = await identifierInput(canvasElement);
    expect(input).toHaveValue("http://example.org/people/alice");

    await userEvent.clear(input);
    await userEvent.type(input, "http://example.org/people/alice-smith");
    await userEvent.click(canvas.getByRole("button", { name: "Update" }));

    const result = await waitFor(() => {
      if (!submitted) throw new Error("onSubmit has not fired yet");
      return submitted;
    });
    const alice = "http://example.org/people/alice";
    const aliceSmith = "http://example.org/people/alice-smith";
    expect(result.focusNode?.value).toBe(aliceSmith);
    // The resource's own triples, and Bob's link pointing at it, all moved.
    expect(result.dataGraph.getQuads(factory.namedNode(alice))).toEqual([]);
    expect(result.dataGraph.getQuads(null, null, factory.namedNode(alice))).toEqual([]);
    expect(result.dataGraph.getQuads(factory.namedNode(aliceSmith)).length).toBe(2);
    expect(
      result.dataGraph.getQuads(
        factory.namedNode("http://example.org/people/bob"),
        null,
        factory.namedNode(aliceSmith),
      ).length,
    ).toBe(1);
  },
};

export const rejectsUnusableIris: Story = {
  name: "On: an invalid, already used or pattern-violating IRI isn't accepted",
  args: { ...baseArgs, enableFocusNodeEditor: true, onSubmit } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    submitted = undefined;
    const canvas = within(canvasElement);
    const input = await identifierInput(canvasElement);

    await userEvent.clear(input);
    await userEvent.type(input, "not an iri");
    expect(await violation(canvasElement)).toHaveTextContent("Enter an absolute IRI");

    await userEvent.clear(input);
    await userEvent.type(input, "http://example.org/people/bob");
    expect(await violation(canvasElement)).toHaveTextContent("already identifies another resource");

    // PersonShape's own sh:pattern applies to the focus node's IRI.
    await userEvent.clear(input);
    await userEvent.type(input, "http://example.org/animals/rex");
    expect(await violation(canvasElement)).toHaveTextContent("doesn't match the pattern");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.closest(".st-property-object")).toHaveAttribute("data-severity", "Violation");

    // A rejected value is never committed: submitting keeps the original IRI.
    await userEvent.click(canvas.getByRole("button", { name: "Update" }));
    const result = await waitFor(() => {
      if (!submitted) throw new Error("onSubmit has not fired yet");
      return submitted;
    });
    expect(result.focusNode?.value).toBe("http://example.org/people/alice");
    expect(result.additions).toEqual([]);
  },
};

export const namesAResourceCreatedInPlace: Story = {
  name: 'On, with enableCreateInPlace: "Create new…" gets an identifier field too',
  args: {
    ...baseArgs,
    dataGraph: `
      @prefix schema: <http://schema.org/> .
      <http://example.org/people/alice> a schema:Person ; schema:name "Alice" .
    `,
    enableFocusNodeEditor: true,
    enableCreateInPlace: true,
    onSubmit,
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    submitted = undefined;
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("- Select an option -", {}, { timeout: 5000 }));
    await userEvent.click(await canvas.findByText("Create new…"));

    const dialog = within(await canvas.findByRole("dialog"));
    const input = await dialog.findByLabelText("Identifier");
    expect((input as HTMLInputElement).value).toMatch(/^urn:uuid:/);
    await userEvent.clear(input);
    await userEvent.type(input, "http://example.org/people/carol");
    await userEvent.click(dialog.getByRole("button", { name: "Done" }));

    await userEvent.click(canvas.getByRole("button", { name: "Update" }));
    const result = await waitFor(() => {
      if (!submitted) throw new Error("onSubmit has not fired yet");
      return submitted;
    });
    const carol = factory.namedNode("http://example.org/people/carol");
    expect(
      result.dataGraph.getQuads(factory.namedNode("http://example.org/people/alice"), null, carol)
        .length,
    ).toBe(1);
    expect(result.dataGraph.getQuads(carol).length).toBeGreaterThan(0);
    expect(result.additions.some((quad) => quad.subject.value.startsWith("urn:uuid:"))).toBe(false);
  },
};
