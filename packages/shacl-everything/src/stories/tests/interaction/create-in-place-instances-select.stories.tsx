import type { StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { factory } from "@/helpers/factory.ts";
import type { SubmitResult } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// shui:InstancesSelectEditor's "Create new…" row (useCreateInPlace, shared with
// AutoCompleteEditor - see edit-and-create-in-place.stories.tsx for that widget's own flow): the
// new instance is staged in a scratch copy, so only Done writes anything to the real dataGraph -
// the new subject's rdf:type, its fields and the link to it, as one change set.
export default {
  title: "Tests/Interaction/Create in place (InstancesSelectEditor)",
  component: ShaclRenderer,
};

const shapesGraph = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  @prefix shui: <http://www.w3.org/ns/shacl-ui/> .
  ex:shape a sh:NodeShape ;
    sh:targetClass schema:Person ;
    sh:property [
      sh:name "Employer"@en ;
      sh:path ex:employer ;
      sh:class ex:Organization ;
      sh:nodeKind sh:IRI ;
      sh:maxCount 1 ;
      sh:node ex:organizationShape ;
      shui:editor shui:InstancesSelectEditor ;
    ] .
  ex:organizationShape a sh:NodeShape ;
    sh:targetClass ex:Organization ;
    sh:property [
      sh:name "Name"@en ;
      sh:path rdfs:label ;
      sh:datatype xsd:string ;
      sh:maxCount 1 ;
      shui:propertyRole shui:LabelRole ;
    ] .
`;
const dataGraph = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix schema: <http://schema.org/> .
  @prefix ex: <http://example.org/> .
  ex:data a schema:Person .
  ex:acme a ex:Organization ; rdfs:label "Acme Corp" .
`;

let submittedResult: SubmitResult | undefined;

const args = {
  shapesGraph,
  dataGraph,
  nodeShapes: [factory.namedNode("http://example.org/shape")],
  focusNode: factory.namedNode("http://example.org/data"),
  enableCreateInPlace: true,
  onSubmit: (result: SubmitResult) => {
    submittedResult = result;
  },
} as ShaclRendererProps;

async function openCreateDialog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByText("- Select an option -", {}, { timeout: 5000 }));
  await userEvent.click(await canvas.findByText("Create new…"));
  const dialog = await canvas.findByRole("dialog");
  await expect(within(dialog).findByText("New item")).resolves.toBeVisible();
  return dialog;
}

async function submit(canvasElement: HTMLElement): Promise<SubmitResult> {
  await userEvent.click(canvasElement.querySelector<HTMLButtonElement>('button[type="submit"]')!);
  return waitFor(() => {
    if (!submittedResult) throw new Error("onSubmit has not fired yet");
    return submittedResult;
  });
}

export const doneWritesTheNewInstanceAndLinksIt: Story = {
  name: "Done writes the new instance's type, fields and link - nothing else",
  args,
  play: async ({ canvasElement }) => {
    submittedResult = undefined;
    const canvas = within(canvasElement);
    const dialog = await openCreateDialog(canvasElement);

    await userEvent.type(within(dialog).getByRole("textbox"), "Umbrella Corp");
    await userEvent.tab();
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());

    // (Not asserting the closed trigger's label here: InstancesSelectEditor doesn't re-resolve it
    // for the freshly-adopted value today - same before useCreateInPlace existed.)
    const result = await submit(canvasElement);
    expect(result.deletions).toEqual([]);
    const subject = result.additions.find((quad) => quad.predicate.value.endsWith("#type"))?.subject;
    expect(subject?.value).toMatch(/^urn:uuid:/);
    const summary = result.additions
      .map((quad) => `${quad.subject.equals(subject!) ? "new" : quad.subject.value} ${quad.predicate.value} ${quad.object.equals(subject!) ? "new" : quad.object.value}`)
      .sort();
    expect(summary).toEqual([
      "http://example.org/data http://example.org/employer new",
      "new http://www.w3.org/1999/02/22-rdf-syntax-ns#type http://example.org/Organization",
      "new http://www.w3.org/2000/01/rdf-schema#label Umbrella Corp",
    ]);
  },
};

export const closingTheDialogDiscardsTheDraft: Story = {
  name: "Closing the dialog without Done leaves the real dataGraph untouched",
  args,
  play: async ({ canvasElement }) => {
    submittedResult = undefined;
    const canvas = within(canvasElement);
    const dialog = await openCreateDialog(canvasElement);

    await userEvent.type(within(dialog).getByRole("textbox"), "Never saved");
    await userEvent.tab();
    await userEvent.click(dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!);
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());

    expect(canvas.queryByText("Never saved")).toBeNull();
    const result = await submit(canvasElement);
    expect(result.additions).toEqual([]);
    expect(result.deletions).toEqual([]);
  },
};
