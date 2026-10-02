import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import { dc, rdfs } from "@/helpers/namespaces.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// Environment.enableAlternativePathSwitching: a property whose sh:path is a top-level
// sh:alternativePath with only plain-predicate branches (e.g. dc:title/rdfs:label) gets an
// AlternativePathSwitcher fly-out to manually move an existing value to a different branch
// predicate - see structure/paths/alternativePathBranches.ts and
// PropertyUIElement.setAlternativePathBranch.
export default {
  title: "Environment/enableAlternativePathSwitching",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix dc: <http://purl.org/dc/elements/1.1/> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:CreativeWork ;
    sh:property [
      sh:name "Title"@en ;
      sh:path [ sh:alternativePath (dc:title rdfs:label) ] ;
      sh:minCount 1 ;
      sh:datatype xsd:string ;
    ] .
`;
// Only one branch (dc:title) starts with a value - a clean base for testing an unambiguous move,
// unlike the "SHACL core 1.2/4.3.b" spec fixture, which has both dc:title and rdfs:label
// populated at once (built to test merged reads, not a move).
const dataGraph = `
  @prefix schema: <http://schema.org/> .
  @prefix dc: <http://purl.org/dc/elements/1.1/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:CreativeWork ; dc:title "On the Origin of Species" .
`;

const baseArgs = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
};

async function findWidgetInput(canvasElement: HTMLElement): Promise<HTMLElement> {
  return waitFor(() => {
    const element = canvasElement.querySelector<HTMLElement>(".st-property-object__widget input");
    if (!element) throw new Error("expected an active widget input to render");
    return element;
  });
}

export const disabled: Story = {
  name: "Off: focusing the value shows no branch picker, even though the path has alternative branches",
  args: { ...baseArgs, enableAlternativePathSwitching: false } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const input = await findWidgetInput(canvasElement);
    input.focus();
    await waitFor(() =>
      expect(canvasElement.querySelector(".st-property-object__fly-out")).not.toBeNull(),
    );
    expect(canvasElement.querySelector(".st-alternative-path-switcher")).toBeNull();
  },
};

export const enabled: Story = {
  name: "On: focusing an existing value shows a picker for the alternative path's branches",
  args: { ...baseArgs, enableAlternativePathSwitching: true } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const input = await findWidgetInput(canvasElement);
    input.focus();
    await waitFor(() =>
      expect(canvasElement.querySelector(".st-alternative-path-switcher")).not.toBeNull(),
    );
  },
};

let submittedResult: SubmitResult | undefined;
const onSubmit = (result: SubmitResult) => {
  submittedResult = result;
};

export const pickingTheOtherBranchMovesTheValue: Story = {
  name: "Picking rdfs:label moves the value out of dc:title and into rdfs:label in the data graph",
  args: { ...baseArgs, enableAlternativePathSwitching: true, onSubmit } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    submittedResult = undefined;

    const input = await findWidgetInput(canvasElement);
    input.focus();

    const trigger = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLButtonElement>(
        ".st-alternative-path-switcher .st-select",
      );
      if (!el) throw new Error("expected the alternative-path switcher's trigger to render");
      return el;
    });
    expect(trigger.dataset.value).toBe(dc("title").value);
    // The prefixed IRI shows after the label, e.g. "title (dc:title)" - see helpers/prefixedIri.tsx.
    expect(trigger.textContent).toContain("(dc:title)");

    await userEvent.click(trigger);
    const option = await canvas.findByRole("option", { name: /\(rdfs:label\)/ });
    await userEvent.click(option);

    await waitFor(() => expect(trigger.dataset.value).toBe(rdfs("label").value));

    const submitButton = await canvas.findByRole("button", { name: "Update" }, { timeout: 5000 });
    await userEvent.click(submitButton);

    const result = await waitFor(() => {
      if (!submittedResult) throw new Error("onSubmit has not fired yet");
      return submittedResult;
    });

    expect(result.dataGraph.getQuads(baseArgs.focusNode, dc("title")).length).toBe(0);
    expect(
      result.dataGraph.getQuads(baseArgs.focusNode, rdfs("label")).map((quad) => quad.object.value),
    ).toEqual(["On the Origin of Species"]);
    expect(result.deletions.map((quad) => quad.predicate.value)).toContain(dc("title").value);
    expect(result.additions.map((quad) => quad.predicate.value)).toContain(rdfs("label").value);
  },
};
